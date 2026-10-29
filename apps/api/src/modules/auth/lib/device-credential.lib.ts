import { toBase64Url } from "@/common/base64url.lib.ts";

const credentialBytes = 32;
const hexRadix = 16;
const hexDigitsPerByte = 2;

export function newCredential(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(credentialBytes)));
}

// The credential is random and long, so a plain SHA-256 is enough to keep a leaked table useless.
export async function credentialHashOf(credential: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(credential));

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(hexRadix).padStart(hexDigitsPerByte, "0"))
    .join("");
}

const browsers: Array<[RegExp, string]> = [
  [/Edg\//, "Edge"],
  [/YaBrowser\//, "Яндекс Браузер"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const systems: Array<[RegExp, string]> = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
];

function nameIn(userAgent: string, names: Array<[RegExp, string]>): string | undefined {
  return names.find(([pattern]) => pattern.test(userAgent))?.[1];
}

export function deviceLabelOf(userAgent: string | undefined): string {
  const label = [nameIn(userAgent ?? "", browsers), nameIn(userAgent ?? "", systems)]
    .filter(Boolean)
    .join(" · ");

  return label === "" ? "Неизвестное устройство" : label;
}
