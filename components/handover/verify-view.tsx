"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { canonicalJson, sha256Hex, type CanonicalRecord } from "@/lib/seal/canonical";
import { formatDateTime, formatEuros } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";

interface Report {
  stored_hash: string;
  recomputed_hash: string;
  record_ok: boolean;
  files: { label: string; path: string; stored: string | null; actual: string | null; ok: boolean }[];
  intact: boolean;
  canonical: string;
  checked_at: string;
}

type Verdict = { intact: boolean; hash: string; note: string; fraud?: { before: string; after: string } };

function HashDiff({ reference, value }: { reference: string; value: string }) {
  return (
    <span className="break-all font-mono text-[12.5px] leading-relaxed tracking-wide">
      {value.split("").map((c, i) => (
        <span key={i} className={c !== reference[i] ? "bg-warn/25 text-warn" : ""}>
          {c}
        </span>
      ))}
    </span>
  );
}

export function VerifyView({ id, orderRef }: { id: string; orderRef: string }) {
  const reduce = useReducedMotion();
  const [report, setReport] = useState<Report | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const verify = async () => {
    setRunning(true);
    setError(null);
    setVerdict(null);
    try {
      const res = await fetch(`/api/handovers/${id}/verify`, { cache: "no-store" });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Vérification impossible");
      const r = (await res.json()) as Report;
      // Recalcul indépendant dans le navigateur (WebCrypto) à partir de la chaîne canonique.
      const local = await sha256Hex(r.canonical);
      const intact = r.intact && local === r.stored_hash;
      setReport(r);
      await new Promise((ok) => setTimeout(ok, reduce ? 0 : 450));
      setVerdict({ intact, hash: local, note: intact ? "Toutes les empreintes correspondent." : "Au moins une donnée ou un fichier ne correspond plus au scellé." });
      haptic(intact ? "check" : "error");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const simulateFraud = async () => {
    if (!report) return;
    const record = JSON.parse(report.canonical) as CanonicalRecord;
    const before = formatEuros(record.amount_cents);
    // Copie en mémoire uniquement : rien n'est modifié en base.
    const forged: CanonicalRecord = { ...record, amount_cents: (record.amount_cents ?? 0) + 100 };
    const hash = await sha256Hex(canonicalJson(forged));
    setVerdict({ intact: false, hash, note: "Simulation : montant augmenté de 1 € sur une copie en mémoire.", fraud: { before, after: formatEuros(forged.amount_cents) } });
    haptic("error");
  };

  return (
    <div className="pb-8 pt-4">
      <Link href={`/app/remises/${id}`} className="kicker flex h-10 items-center gap-1 text-ink">
        ← #{orderRef}
      </Link>
      <h1 className="display mt-1 text-[56px]">Vérifier</h1>
      <p className="mt-1 text-[15px] text-muted">On relit la remise et chaque fichier, on recalcule l&apos;empreinte SHA-256 ici, dans votre navigateur, et on la compare à celle du scellé.</p>

      <div className="relative mt-5 flex min-h-[170px] items-center justify-center overflow-hidden border-y-[1.5px] border-ink px-2 py-6" aria-live="polite" data-testid="verdict">
        <AnimatePresence mode="wait">
          {running && !verdict ? (
            <motion.span key="run" className="kicker blink" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Recalcul en cours…
            </motion.span>
          ) : verdict ? (
            <motion.div
              key={verdict.hash}
              className="stamp"
              style={{ "--stamp-color": verdict.intact ? "var(--ok)" : "var(--warn)" } as React.CSSProperties}
              initial={reduce ? { opacity: 0 } : { scale: 2.2, opacity: 0, rotate: -16 }}
              animate={{ scale: 1, opacity: 0.95, rotate: -6 }}
              transition={{ type: "spring", stiffness: 520, damping: 18 }}
            >
              <span className="text-center text-[clamp(30px,10vw,44px)] leading-none">{verdict.intact ? "Preuve intacte" : "Preuve modifiée"}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      {verdict ? <p className="mt-2 text-center text-[14px] text-muted">{verdict.note}</p> : null}
      {verdict?.fraud ? (
        <p className="mt-1 text-center font-mono text-[13px]">
          Montant : {verdict.fraud.before} → <span className="text-warn">{verdict.fraud.after}</span>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 font-semibold text-warn">
          {error}
        </p>
      ) : null}

      {report ? (
        <div className="mt-5 space-y-3">
          <div className="plate p-3">
            <div className="kicker">Empreinte scellée</div>
            <div className="mt-1 break-all font-mono text-[12.5px] leading-relaxed tracking-wide">{report.stored_hash}</div>
            <div className="kicker mt-3">Empreinte recalculée</div>
            <div className="mt-1">
              <HashDiff reference={report.stored_hash} value={verdict?.hash ?? report.recomputed_hash} />
            </div>
          </div>
          <ul className="plate divide-y divide-line">
            {report.files.map((f) => (
              <li key={f.path} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[14px]">
                <span>{f.label}</span>
                <span className={`font-mono text-[12px] font-semibold uppercase ${f.ok ? "text-ok" : "text-warn"}`}>{f.ok ? "✓ conforme" : "✗ différent"}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-[14px]">
              <span>Données de la remise</span>
              <span className={`font-mono text-[12px] font-semibold uppercase ${report.record_ok ? "text-ok" : "text-warn"}`}>{report.record_ok ? "✓ conforme" : "✗ différent"}</span>
            </li>
          </ul>
          <p className="text-[12.5px] text-muted">Vérifié le {formatDateTime(report.checked_at)}. Preuve horodatée et vérifiable : l&apos;empreinte couvre la chaîne canonique ci-dessous.</p>
          <details className="plate p-3">
            <summary className="kicker cursor-pointer">Chaîne canonique</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px]">{JSON.stringify(JSON.parse(report.canonical), null, 2)}</pre>
          </details>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={verify} disabled={running}>
              Revérifier
            </Button>
            <Button variant="danger" onClick={simulateFraud} disabled={running} data-testid="simulate-fraud">
              Simuler une fraude
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
