import { createHash, createHmac } from "node:crypto";

export type TelegramUserFixture = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  allows_write_to_pm?: boolean;
  photo_url?: string;
};

type SignInitDataOptions = {
  botToken: string;
  user: TelegramUserFixture;
  authDate: string;
};

function hmac(key: string | Buffer, message: string): Buffer {
  return createHmac("sha256", key).update(message).digest();
}

export function signInitData({ botToken, user, authDate }: SignInitDataOptions): string {
  const fields = new URLSearchParams({
    auth_date: String(Math.floor(Date.parse(authDate) / 1000)),
    query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    signature: "c2lnbmF0dXJlLWZvci10aGlyZC1wYXJ0aWVz",
    user: JSON.stringify(user),
  });
  const dataCheckString = [...fields.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .toSorted()
    .join("\n");
  const secret = hmac("WebAppData", botToken);

  fields.set("hash", hmac(secret, dataCheckString).toString("hex"));

  return fields.toString();
}

export function tamperUser(initData: string, user: TelegramUserFixture): string {
  const fields = new URLSearchParams(initData);

  fields.set("user", JSON.stringify(user));

  return fields.toString();
}

// What the Telegram Login widget hands the page: the user's fields, auth_date and the hash keyed
// by SHA-256 of the bot token, or, to forge one, by the WebAppData HMAC that signs initData.
export function signTelegramLogin(
  { botToken, user, authDate }: SignInitDataOptions,
  { keyedAs = "login" }: { keyedAs?: "login" | "initData" } = {},
) {
  const { allows_write_to_pm: _ignored, ...fields } = user;
  const login = { ...fields, auth_date: Math.floor(Date.parse(authDate) / 1000) };
  const dataCheckString = Object.entries(login)
    .map(([key, value]) => `${key}=${String(value)}`)
    .toSorted()
    .join("\n");
  const secret =
    keyedAs === "login"
      ? createHash("sha256").update(botToken).digest()
      : hmac("WebAppData", botToken);

  return { ...login, hash: hmac(secret, dataCheckString).toString("hex") };
}
