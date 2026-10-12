import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { describeEvent } from "../dossier";
import { disputeLabel, PLATFORM_META, SLOT_META, STATUS_META, VEHICLE_META } from "../platforms";
import { formatDateTime, formatEuros, formatTime } from "../format";
import type { HandoverDetail, Restaurant } from "../types";

const INK = "#15181B";
const MUTED = "#5B656C";
const LINE = "#CBD1D5";
const ACCENT = "#2F3BD1";

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", fontSize: 10, color: INK, backgroundColor: "#FFFFFD" },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 22, letterSpacing: 2 },
  kicker: { fontFamily: "Courier", fontSize: 8, color: MUTED, letterSpacing: 1, textTransform: "uppercase" },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 30, marginTop: 6 },
  rule: { borderBottomWidth: 1, borderBottomColor: LINE, borderBottomStyle: "dashed", marginVertical: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  label: { color: MUTED, fontSize: 9 },
  value: { fontFamily: "Courier-Bold", fontSize: 10 },
  section: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 14, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" },
  photos: { flexDirection: "row", gap: 8 },
  photo: { width: 165, objectFit: "contain", borderWidth: 1, borderColor: LINE },
  caption: { fontFamily: "Courier", fontSize: 7, color: MUTED, marginTop: 3, width: 165 },
  hash: { fontFamily: "Courier", fontSize: 8.5, marginTop: 4, padding: 6, borderWidth: 1, borderColor: ACCENT, color: ACCENT },
  stamp: { position: "absolute", top: 40, right: 36, borderWidth: 2.5, borderColor: ACCENT, color: ACCENT, padding: 6, fontFamily: "Helvetica-Bold", fontSize: 14, transform: "rotate(-8deg)", textAlign: "center" },
  event: { fontSize: 9, marginBottom: 3 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7.5, color: MUTED, fontFamily: "Courier" },
});

export interface DossierImages {
  photos: Record<string, Buffer | null>;
  signature: Buffer | null;
  courier: { buffer: Buffer; captured_at: string }[];
}

export function DossierDocument({ h, restaurant, images, receiptUrl, generatedAt }: { h: HandoverDetail; restaurant: Pick<Restaurant, "name" | "city" | "address">; images: DossierImages; receiptUrl: string | null; generatedAt: string }) {
  const dispute = [...h.events].reverse().find((e) => e.type === "litige_open");
  const fields: [string, string][] = [
    ["Commande", `#${h.order_ref}`],
    ["Plateforme", PLATFORM_META[h.platform].label],
    ["Montant", formatEuros(h.amount_cents)],
    ["Articles", String(h.items_count)],
    ["Livreur", `${h.courier_name_snapshot} — ${VEHICLE_META[h.vehicle].label}`],
    ["Code de retrait", h.pickup_code ?? "—"],
    ["Heure de remise (serveur)", formatDateTime(h.sealed_at)],
    ["Remis par", h.sealed_by_name ?? "—"],
    ["Statut", STATUS_META[h.status].label],
  ];
  return (
    <Document title={`Dossier remise #${h.order_ref}`} author={restaurant.name} creator="REMIS." producer="REMIS.">
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>REMIS.</Text>
        <Text style={s.kicker}>Dossier de remise · preuve horodatée et vérifiable</Text>
        <Text style={s.h1}>#{h.order_ref}</Text>
        <Text style={s.label}>
          {restaurant.name} · {restaurant.address ?? restaurant.city}
        </Text>
        <View style={s.stamp}>
          <Text>REMIS</Text>
          <Text style={{ fontFamily: "Courier-Bold", fontSize: 11 }}>{formatTime(h.sealed_at)}</Text>
        </View>
        <View style={s.rule} />
        {fields.map(([k, v]) => (
          <View key={k} style={s.row}>
            <Text style={s.label}>{k}</Text>
            <Text style={s.value}>{v}</Text>
          </View>
        ))}
        {dispute ? (
          <View style={{ marginTop: 6 }}>
            <Text style={s.label}>Motif de la réclamation</Text>
            <Text style={s.value}>
              {disputeLabel((dispute.payload as { reason?: string }).reason)}
              {(dispute.payload as { note?: string }).note ? ` — ${(dispute.payload as { note?: string }).note}` : ""}
            </Text>
          </View>
        ) : null}

        <Text style={s.section}>Photos</Text>
        <View style={s.photos}>
          {h.photos.map((p) => {
            const buf = images.photos[p.slot];
            return (
              <View key={p.slot}>
                {buf ? <Image style={s.photo} src={{ data: buf, format: "jpg" }} /> : <Text>(photo indisponible)</Text>}
                <Text style={s.caption}>
                  {SLOT_META[p.slot].label} · {formatTime(p.captured_at)}
                </Text>
                <Text style={s.caption}>{p.sha256.slice(0, 32)}</Text>
              </View>
            );
          })}
        </View>

        {images.signature ? (
          <View style={{ marginTop: 10 }}>
            <Text style={s.label}>Signature du livreur</Text>
            <Image style={{ width: 180, height: 68, objectFit: "contain" }} src={{ data: images.signature, format: "png" }} />
          </View>
        ) : null}

        <Text style={s.section}>Intégrité</Text>
        <Text style={s.label}>Empreinte SHA-256 de la remise (données + photos + signature + heure serveur)</Text>
        <Text style={s.hash}>{h.hash_sha256}</Text>
        {receiptUrl ? <Text style={[s.label, { marginTop: 4 }]}>Reçu vérifiable : {receiptUrl}</Text> : null}

        <Text style={s.section}>Historique</Text>
        {h.events.map((e) => (
          <Text key={e.id} style={s.event}>
            {formatDateTime(e.created_at)} — {describeEvent(e)}
          </Text>
        ))}

        {images.courier.length > 0 ? (
          <>
            <Text style={s.section}>Photos ajoutées par le livreur (hors scellé)</Text>
            <View style={s.photos}>
              {images.courier.map((c, i) => (
                <View key={i}>
                  <Image style={s.photo} src={{ data: c.buffer, format: "jpg" }} />
                  <Text style={s.caption}>{formatDateTime(c.captured_at)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={s.footer} fixed>
          Généré le {formatDateTime(generatedAt)} par REMIS. — La commande a été remise fermée et complète au livreur à l&apos;heure indiquée. Toute modification d&apos;une donnée ou d&apos;une photo change l&apos;empreinte.
        </Text>
      </Page>
    </Document>
  );
}
