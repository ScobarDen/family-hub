import { z } from "zod";

import { hexToBytes, hmacKey, isFreshAuthDate } from "./telegram-signature.lib.ts";

const telegramUser = z.object({
  id: z.number().int(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  allows_write_to_pm: z.boolean().optional(),
  photo_url: z.string().optional(),
});

export type TelegramUser = z.infer<typeof telegramUser>;

export function displayNameOf(user: TelegramUser): string {
  return [user.first_name, user.last_name].filter(Boolean).join(" ");
}

type VerifyInitDataOptions = {
  initData: string;
  botToken: string;
  now: number;
};

const encoder = new TextEncoder();

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

  if (
    !isFreshAuthDate(Number(fields.get("auth_date")), now) ||
    !(await isSignedByBot(fields, botToken))
  ) {
    return undefined;
  }

  return parseUser(fields.get("user"));
}
