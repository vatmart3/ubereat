/**
 * Horodatage du scellé.
 *
 * V1 : horloge du serveur (`ServerClockProvider`). Le `sealed_at` n'est jamais fourni par le client
 * et la base refuse un écart de plus de 120 s avec son propre `now()`.
 *
 * Plus tard : un prestataire d'horodatage qualifié eIDAS (RFC 3161). Le flux est prévu :
 *   1. `now()` fixe l'instant du scellé (il entre dans la chaîne canonique),
 *   2. l'empreinte est calculée,
 *   3. `attest(hash)` envoie l'empreinte à la TSA et renvoie le jeton signé (TimeStampToken, base64),
 *      stocké dans `handovers.timestamp_token`.
 */

export interface TimestampAttestation {
  provider: string;
  token: string | null;
}

export interface TimestampProvider {
  readonly id: string;
  now(): Promise<Date>;
  attest(hashHex: string): Promise<TimestampAttestation>;
}

export class ServerClockProvider implements TimestampProvider {
  readonly id = "server";
  async now(): Promise<Date> {
    return new Date();
  }
  async attest(): Promise<TimestampAttestation> {
    return { provider: this.id, token: null };
  }
}

/**
 * Squelette RFC 3161 : à brancher sur une TSA qualifiée (ex. Certigna, Universign).
 * Volontairement non activé en V1 : `TIMESTAMP_PROVIDER=rfc3161` lève une erreur explicite
 * tant que l'encodage ASN.1 du TimeStampReq n'est pas implémenté et testé contre la TSA choisie.
 */
export class Rfc3161Provider implements TimestampProvider {
  readonly id = "rfc3161";
  constructor(private readonly tsaUrl: string) {}
  async now(): Promise<Date> {
    return new Date();
  }
  async attest(hashHex: string): Promise<TimestampAttestation> {
    void hashHex;
    throw new Error(`Horodatage RFC 3161 non configuré (TSA: ${this.tsaUrl}).`);
  }
}

export function getTimestampProvider(): TimestampProvider {
  const kind = process.env.TIMESTAMP_PROVIDER ?? "server";
  if (kind === "rfc3161" && process.env.TSA_URL) return new Rfc3161Provider(process.env.TSA_URL);
  return new ServerClockProvider();
}
