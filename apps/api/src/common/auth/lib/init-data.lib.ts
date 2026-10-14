import { z } from "zod";

const maxAgeMs = 3_600_000;
const msPerSecond = 1000;
const hexPair = /^(?:[\da-f]{2})+$/;

const telegramUser = z.object({ id: z.number().int() });

export type TelegramUser = z.infer<typeof telegramUser>;

type VerifyInitDataOptions = {
  initData: string;
  botToken: string;
  now: number;
};

const encoder = new TextEncoder();

async function hmacKey(secret: BufferSource, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | undefined {
  if (!hexPair.test(hex)) {
    return undefined;
  }

  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}

function dataCheckString(fields: URLSearchParams): string {
  return [...fields.entries()]
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`)
    .toSorted()
    .join("\n");
}

async function isSignedByBot(fields: URLSearchParams, botToken: string): Promise<boolean> {
  const hash = hexToBytes(fields.get("hash") ?? "");

  if (!hash) {
    return false;
  }

  const webAppKey = await hmacKey(encoder.encode("WebAppData"), "sign");
  const secret = await crypto.subtle.sign("HMAC", webAppKey, encoder.encode(botToken));
  const verifier = await hmacKey(secret, "verify");

  return crypto.subtle.verify("HMAC", verifier, hash, encoder.encode(dataCheckString(fields)));
}

function isFresh(fields: URLSearchParams, now: number): boolean {
  const authDate = Number(fields.get("auth_date"));

  return Number.isInteger(authDate) && now - authDate * msPerSecond <= maxAgeMs;
}

function parseUser(raw: string | null): TelegramUser | undefined {
  try {
    return telegramUser.parse(JSON.parse(raw ?? ""));
  } catch {
    return undefined;
  }
}

export async function verifyInitData({
  initData,
  botToken,
  now,
}: VerifyInitDataOptions): Promise<TelegramUser | undefined> {
  const fields = new URLSearchParams(initData);

  if (!isFresh(fields, now) || !(await isSignedByBot(fields, botToken))) {
    return undefined;
  }

  return parseUser(fields.get("user"));
}
