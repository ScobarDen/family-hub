import { fromBase64Url } from "@/common/base64url.lib.ts";

const recordSize = 4096;
const recordSizeBytes = 4;
const keyIdLengthBytes = 1;
const saltBytes = 16;
const ikmBytes = 32;
const cekBytes = 16;
const nonceBytes = 12;
const bitsPerByte = 8;
const lastRecordDelimiter = 0x02;
const encoder = new TextEncoder();

export type SubscriptionKeys = { p256dh: string; auth: string };

// The sender's one-off ECDH key pair; tests pass the RFC's own.
export type SenderKeys = { publicKey: Uint8Array<ArrayBuffer>; privateKey: CryptoKey };

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const joined = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;

  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }

  return joined;
}

async function hkdf(
  { salt, ikm, info }: { salt: BufferSource; ikm: BufferSource; info: BufferSource },
  bytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    bytes * bitsPerByte,
  );

  return new Uint8Array(bits);
}

export async function generateSenderKeys(): Promise<SenderKeys> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- an ECDH key is always a pair
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- "raw" always exports bytes
  const publicKey = (await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer;

  return { publicKey: new Uint8Array(publicKey), privateKey: pair.privateKey };
}

// The input keying material binds the ECDH secret to the subscription's auth secret and both keys.
async function keyingMaterialOf(keys: SubscriptionKeys, sender: SenderKeys) {
  const receiverPublic = fromBase64Url(keys.p256dh);
  const receiverKey = await crypto.subtle.importKey(
    "raw",
    receiverPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  // Workers' types spell the reserved word `$public`; the runtime takes the standard `public`.
  const ecdh = { name: "ECDH", public: receiverKey };
  const ecdhSecret = await crypto.subtle.deriveBits(
    ecdh,
    sender.privateKey,
    ikmBytes * bitsPerByte,
  );

  return hkdf(
    {
      salt: fromBase64Url(keys.auth),
      ikm: ecdhSecret,
      info: concat(encoder.encode("WebPush: info\0"), receiverPublic, sender.publicKey),
    },
    ikmBytes,
  );
}

function headerOf(salt: Uint8Array, senderPublic: Uint8Array): Uint8Array<ArrayBuffer> {
  const header = new Uint8Array(saltBytes + recordSizeBytes + keyIdLengthBytes);

  header.set(salt);
  new DataView(header.buffer).setUint32(saltBytes, recordSize);
  header[saltBytes + recordSizeBytes] = senderPublic.length;

  return concat(header, senderPublic);
}

// RFC 8291: one aes128gcm record, keyed by ECDH with the subscription's key and its auth secret.
export async function encryptPayload(
  plaintext: string,
  keys: SubscriptionKeys,
  {
    sender,
    salt = crypto.getRandomValues(new Uint8Array(saltBytes)),
  }: { sender: SenderKeys; salt?: Uint8Array<ArrayBuffer> },
): Promise<Uint8Array<ArrayBuffer>> {
  const ikm = await keyingMaterialOf(keys, sender);
  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const cek = await hkdf({ salt, ikm, info: cekInfo }, cekBytes);
  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const nonce = await hkdf({ salt, ikm, info: nonceInfo }, nonceBytes);
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    concat(encoder.encode(plaintext), Uint8Array.of(lastRecordDelimiter)),
  );

  return concat(headerOf(salt, sender.publicKey), new Uint8Array(ciphertext));
}
