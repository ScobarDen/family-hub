import type { TelegramWidgetLogin } from "@family-hub/contract";

import { telegramLoginMaxAgeMs } from "../auth.config.ts";
import { hexToBytes, hmacKey, isFreshAuthDate, type TelegramUser } from "./init-data.lib.ts";

const encoder = new TextEncoder();

function dataCheckString(login: TelegramWidgetLogin): string {
  return Object.entries(login)
    .filter(([key, value]) => key !== "hash" && value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .toSorted()
    .join("\n");
}

// Telegram Login keys its HMAC with SHA-256 of the bot token, not with the WebAppData HMAC of initData.
async function isSignedByBot(login: TelegramWidgetLogin, botToken: string): Promise<boolean> {
  const hash = hexToBytes(login.hash);

  if (!hash) {
    return false;
  }

  const secret = await crypto.subtle.digest("SHA-256", encoder.encode(botToken));
  const verifier = await hmacKey(secret, "verify");

  return crypto.subtle.verify("HMAC", verifier, hash, encoder.encode(dataCheckString(login)));
}

export async function verifyTelegramLogin({
  login,
  botToken,
  now,
}: {
  login: TelegramWidgetLogin;
  botToken: string;
  now: number;
}): Promise<TelegramUser | undefined> {
  if (
    !isFreshAuthDate(login.auth_date, now, telegramLoginMaxAgeMs) ||
    !(await isSignedByBot(login, botToken))
  ) {
    return undefined;
  }

  return {
    id: login.id,
    first_name: login.first_name,
    last_name: login.last_name,
    username: login.username,
    photo_url: login.photo_url,
  };
}
