import type { Metadata } from "next";
import Link from "next/link";
import { Hero } from "@/components/landing/hero";
import { Calculator } from "@/components/landing/calculator";
import { DemoSteps } from "@/components/landing/demo-steps";
import { StickyCta } from "@/components/landing/sticky-cta";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FAQ, PARTNER_LOGOS, PRICE_EUROS, TESTIMONIALS, TRIAL_DAYS } from "@/lib/landing-content";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  title: { absolute: "REMIS. — Preuve de remise au livreur pour restaurants (Uber Eats, Deliveroo, Just Eat)" },
  description:
    "Litige « commande non reçue » ? Photo du sac, signature du livreur et scellé horodaté en moins de 30 s. Dossier de contestation en un clic. Essai gratuit 14 jours.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "REMIS.",
    title: "Un livreur dit qu'il n'a rien récupéré ? Montrez le ticket.",
    description: "La preuve horodatée et vérifiable de chaque remise restaurant ↔ livreur. 30 secondes au comptoir.",
  },
  twitter: { card: "summary_large_image" },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "REMIS.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android (PWA)",
    inLanguage: "fr-FR",
    description: "Preuve de remise restaurant ↔ livreur : photos, signature, scellé horodaté et vérifiable, dossier de litige en un clic.",
    url: SITE_URL,
    offers: { "@type": "Offer", price: String(PRICE_EUROS), priceCurrency: "EUR", description: `Par établissement et par mois, ${TRIAL_DAYS} jours d'essai gratuit` },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  },
];

function Section({ id, kicker, title, children, className = "" }: { id?: string; kicker: string; title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-[1200px] px-4 py-16 md:py-24 ${className}`} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="kicker">{kicker}</div>
      <h2 id={id ? `${id}-title` : undefined} className="display mb-8 mt-2 max-w-4xl text-[clamp(40px,10vw,84px)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

const RESTO = [
  "Fin des remboursements automatiques « non reçu » : vous avez la photo du sac fermé, à la seconde.",
  "Dossier de contestation prêt à coller dans le support de la plateforme, ou en PDF complet.",
  "Registre de toutes les remises du service, recherche par n° ou par livreur.",
  "L'équipe se connecte au comptoir par PIN : aucune adresse e-mail à taper en plein rush.",
];
const LIVREUR = [
  "Son propre reçu, ouvert par QR code, sans compte ni application.",
  "La preuve qu'il a récupéré une commande fermée, à telle heure : utile quand on l'accuse à tort.",
  "Il peut ajouter sa photo de prise en charge, sans toucher à la preuve du restaurant.",
  "Prénom + initiale seulement, pas de reconnaissance faciale.",
];

export default function LandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4">
          <Link href="/" className="font-display text-[30px] font-black leading-none tracking-wide">
            REMIS<span className="text-accent">.</span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Compte">
            <span className="hidden sm:block">
              <ThemeToggle compact />
            </span>
            <Link href="/login" className="flex h-10 items-center rounded-[3px] border border-line bg-raise px-3 text-[14px] font-semibold">
              Connexion
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <Hero />

        <Section id="cout" kicker="Le coût de l'inaction" title="Combien vous coûtent les « je n'ai rien reçu » ?">
          <Calculator />
        </Section>

        <Section id="demo" kicker="Démo en 3 temps · moins de 30 secondes" title="Photo. Signature. Scellé.">
          <DemoSteps />
          <p className="mt-6 max-w-2xl text-[16px] text-muted">
            Ensuite ? Le ticket s&apos;imprime à l&apos;écran, le tampon tombe, et vous passez au livreur suivant. En cas de réclamation, la fiche contient tout : photos, heure serveur, livreur, empreinte, historique.
          </p>
        </Section>

        <Section id="benefices" kicker="Double bénéfice" title="Une preuve, deux personnes protégées.">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { t: "Pour le restaurant", items: RESTO, tone: "bg-ink text-bg" },
              { t: "Pour le livreur", items: LIVREUR, tone: "bg-accent text-accent-ink" },
            ].map((col) => (
              <div key={col.t} className="plate overflow-hidden">
                <h3 className={`display px-5 py-4 text-[34px] ${col.tone}`}>{col.t}</h3>
                <ul className="divide-y divide-dashed divide-line">
                  {col.items.map((it) => (
                    <li key={it} className="flex gap-3 px-5 py-3.5 text-[16px] leading-snug">
                      <span aria-hidden className="mt-1 font-mono text-[12px] text-accent">
                        ✓
                      </span>
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section id="avis" kicker="Ils protègent leurs remises" title="Au passe, chez eux.">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Logos de restaurants partenaires">
            {(PARTNER_LOGOS.length ? PARTNER_LOGOS : Array.from({ length: 4 }, (_, i) => ({ name: `Emplacement logo ${i + 1}`, src: "" }))).map((l) => (
              <div key={l.name} className="flex h-20 items-center justify-center rounded-[3px] border border-dashed border-line font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.src ? <img src={l.src} alt={l.name} className="max-h-12" /> : l.name}
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {TESTIMONIALS.length
              ? TESTIMONIALS.map((t) => (
                  <figure key={t.name} className="ticket">
                    <blockquote className="text-[15px] leading-snug">« {t.quote} »</blockquote>
                    <figcaption className="mt-3 text-[12px] uppercase tracking-wider text-paper-muted">
                      {t.name} · {t.place}
                    </figcaption>
                  </figure>
                ))
              : Array.from({ length: 3 }, (_, i) => (
                  <figure key={i} className="flex min-h-36 flex-col justify-between rounded-[3px] border border-dashed border-line p-4">
                    <p className="text-[15px] text-muted">Emplacement avis restaurateur — réservé à nos restaurants pilotes.</p>
                    <figcaption className="kicker mt-3">Avis {i + 1} · bientôt</figcaption>
                  </figure>
                ))}
          </div>
        </Section>

        <Section id="tarif" kicker="Tarification" title="Un prix, tout compris.">
          <div className="grid gap-6 md:grid-cols-[1fr_1.2fr] md:items-center">
            <div className="ticket on-paper max-w-sm">
              <div className="text-[12px] uppercase tracking-[0.16em] text-paper-muted">Par établissement</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-[110px] font-black leading-[0.85]">{PRICE_EUROS} €</span>
                <span className="text-[14px] text-paper-muted">/ mois HT</span>
              </div>
              <hr className="ticket-rule" />
              <ul className="space-y-1.5 text-[14px]">
                {["Remises illimitées", "Équipe illimitée, PIN au comptoir", "Dossiers de litige texte + PDF", "Reçus livreurs par QR", "Mode hors ligne", "Purge RGPD automatique"].map((f) => (
                  <li key={f} className="flex justify-between gap-2">
                    <span>{f}</span>
                    <span aria-hidden>✓</span>
                  </li>
                ))}
              </ul>
              <hr className="ticket-rule" />
              <div className="text-center text-[11px] uppercase tracking-[0.16em] text-paper-muted">
                {TRIAL_DAYS} jours gratuits · sans engagement
              </div>
            </div>
            <div>
              <p className="max-w-lg text-[18px] leading-snug">
                Un seul litige « non reçu » évité par mois rembourse presque l&apos;abonnement. Plusieurs établissements ? Chaque restaurant a son espace, son équipe et ses preuves.
              </p>
              <Link href="/login" className="mt-6 inline-flex h-16 w-full items-center justify-center rounded-[3px] bg-ink px-6 text-[18px] font-semibold text-bg sm:w-auto">
                Essayer gratuitement {TRIAL_DAYS} jours
              </Link>
            </div>
          </div>
        </Section>

        <Section id="faq" kicker="Questions fréquentes" title="Ce qu'on nous demande au comptoir.">
          <div className="divide-y divide-line border-y-[1.5px] border-ink">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-1">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[18px] font-semibold leading-snug">
                  {f.q}
                  <span aria-hidden className="font-mono text-[22px] text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="max-w-3xl pb-5 text-[16px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        <section id="cta-final" className="border-y-[1.5px] border-ink bg-ink text-bg">
          <div className="mx-auto max-w-[1200px] px-4 py-16 md:py-24">
            <div className="kicker" style={{ color: "inherit", opacity: 0.6 }}>
              Prochain service
            </div>
            <h2 className="display mt-2 max-w-4xl text-[clamp(44px,11vw,96px)]">Le prochain « je n&apos;ai rien reçu », vous aurez le ticket.</h2>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex h-16 items-center justify-center rounded-[3px] bg-bg px-6 text-[18px] font-semibold text-ink">
                Essayer gratuitement {TRIAL_DAYS} jours
              </Link>
              <Link href="/app" className="inline-flex h-16 items-center justify-center rounded-[3px] border-[1.5px] border-bg/60 px-6 text-[18px] font-semibold">
                Voir la démo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[1200px] px-4 pb-28 pt-10 text-[13px] text-muted md:pb-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-display text-[22px] font-black text-ink">
            REMIS<span className="text-accent">.</span>
          </span>
          <span>Preuve horodatée et vérifiable · Données hébergées dans l&apos;UE · RGPD</span>
        </div>
        <p className="mt-3 max-w-3xl">Uber Eats, Deliveroo et Just Eat sont des marques de leurs propriétaires respectifs. REMIS. est un outil indépendant, non affilié à ces plateformes.</p>
      </footer>
      <StickyCta />
    </>
  );
}
