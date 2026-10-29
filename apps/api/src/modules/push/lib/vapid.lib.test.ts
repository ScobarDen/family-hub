import { describe, expect, test } from "vite-plus/test";

import { fromBase64Url, toBase64Url } from "@/common/base64url.lib.ts";

import { vapidAuthorization } from "./vapid.lib.ts";

// RFC 8292, section 2.4: its signature was made by a key it does not publish, so it checks only
// that we read `k` and the signature the way the RFC writes them.
const rfc = {
  token:
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJodHRwczovL3B1c2guZXhhbXBsZS5uZXQiLCJleHAiOjE0NTM1MjM3NjgsInN1YiI6Im1haWx0bzpwdXNoQGV4YW1wbGUuY29tIn0.i3CYb7t4xfxCDquptFOepC9GAu_HLGkMlMuCGSK2rpiUfnK9ojFwDXb1JrErtmysazNjjvW2L9OkSSHzvoD1oA",
  key: "BA1Hxzyi1RUM1b5wjxsn7nGxAszw2u61m164i3MrAIxHF6YK5h4SDYic-dRuU_RCPCfA5aq9ojSwk5Y2EmClBPs",
};

async function isSignedBy(token: string, publicKey: string): Promise<boolean> {
  const [header = "", body = "", signature = ""] = token.split(".");
  const key = await crypto.subtle.importKey(
    "raw",
    fromBase64Url(publicKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    fromBase64Url(signature),
    new TextEncoder().encode(`${header}.${body}`),
  );
}

async function generatedVapid() {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- an ECDSA key is always a pair
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
  ])) as CryptoKeyPair;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- "raw" always exports bytes
  const raw = (await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- "jwk" always exports a JWK
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  const publicKey = new Uint8Array(raw);

  return {
    publicKey: toBase64Url(publicKey),
    privateKey: jwk.d ?? "",
    subject: "mailto:push@example.com",
  };
}

function jsonOf(part: string): unknown {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(part)));
}

describe("VAPID", () => {
  test("the RFC 8292 example token verifies with its key", async () => {
    expect(await isSignedBy(rfc.token, rfc.key)).toBe(true);
  });

  test("signs the RFC's claims for the push service's origin with the key it sends", async () => {
    const vapid = await generatedVapid();

    const authorization = await vapidAuthorization(vapid, {
      endpoint: "https://push.example.net/push/JzLQ3raZJfFBR0aqvOMsLrt54w4rJUsV",
      now: 1_453_480_568_000,
    });
    const [, token = "", key = ""] = /^vapid t=([^,]+), k=(.+)$/.exec(authorization) ?? [];
    const [header = "", body = ""] = token.split(".");

    expect(key).toBe(vapid.publicKey);
    expect(jsonOf(header)).toEqual({ typ: "JWT", alg: "ES256" });
    expect(jsonOf(body)).toEqual({
      aud: "https://push.example.net",
      exp: 1_453_523_768,
      sub: "mailto:push@example.com",
    });
    expect(await isSignedBy(token, key)).toBe(true);
  });
});
