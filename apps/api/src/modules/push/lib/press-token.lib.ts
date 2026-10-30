import { z } from "zod";

import { fromBase64Url, toBase64Url } from "@/common/base64url.lib.ts";

// What «Готово» and «Отложить» on a Push stand for; the Occurrence travels with them because a
// pushed row has already moved on to the next one (ADR 0016).
const pressClaims = z.object({
  dispatchId: z.string(),
  occurrence: z.string().nullable(),
  memberId: z.string(),
  deviceId: z.string(),
});

export type PressClaims = z.infer<typeof pressClaims>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Derived from the VAPID private key, so rotating VAPID, which drops every subscription, drops
// every button with it.
async function keyOf(vapidPrivateKey: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(vapidPrivateKey),
    "HKDF",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: encoder.encode("push-press") },
    material,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"],
  );
}

function claimsOf(part: string): PressClaims | undefined {
  try {
    return pressClaims.safeParse(JSON.parse(decoder.decode(fromBase64Url(part)))).data;
  } catch {
    return undefined;
  }
}

export function createPressTokens(vapidPrivateKey: string) {
  const key = keyOf(vapidPrivateKey);

  return {
    async sign(claims: PressClaims): Promise<string> {
      const part = toBase64Url(encoder.encode(JSON.stringify(claims)));
      const signature = await crypto.subtle.sign("HMAC", await key, encoder.encode(part));

      return `${part}.${toBase64Url(new Uint8Array(signature))}`;
    },
    async read(token: string): Promise<PressClaims | undefined> {
      const [part = "", signature = ""] = token.split(".");
      const claims = claimsOf(part);

      try {
        const isSigned = await crypto.subtle.verify(
          "HMAC",
          await key,
          fromBase64Url(signature),
          encoder.encode(part),
        );

        return isSigned ? claims : undefined;
      } catch {
        return undefined;
      }
    },
  };
}

export type PressTokens = ReturnType<typeof createPressTokens>;
