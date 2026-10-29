import { initDataClockSkewMs, initDataMaxAgeMs, msPerSecond } from "../auth.config.ts";

const hexPair = /^(?:[\da-f]{2})+$/;

export async function hmacKey(secret: BufferSource, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | undefined {
  if (!hexPair.test(hex)) {
    return undefined;
  }

  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}

export function isFreshAuthDate(
  authDate: number,
  now: number,
  maxAgeMs = initDataMaxAgeMs,
): boolean {
  const ageMs = now - authDate * msPerSecond;

  return Number.isInteger(authDate) && ageMs <= maxAgeMs && ageMs >= -initDataClockSkewMs;
}
