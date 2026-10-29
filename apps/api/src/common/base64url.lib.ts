const base64Quantum = 4;

export function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCodePoint(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replaceAll("-", "+").replaceAll("_", "/");

  return Uint8Array.from(
    atob(base64.padEnd(Math.ceil(base64.length / base64Quantum) * base64Quantum, "=")),
    (char) => char.codePointAt(0) ?? 0,
  );
}
