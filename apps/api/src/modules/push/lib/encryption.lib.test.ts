import { describe, expect, test } from "vite-plus/test";

import { fromBase64Url, toBase64Url } from "@/common/base64url.lib.ts";

import { encryptPayload, generateSenderKeys } from "./encryption.lib.ts";
import { privateJwkOf } from "./vapid.lib.ts";

// RFC 8291, section 5 and appendix A.
const rfc = {
  plaintext: "When I grow up, I want to be a watermelon",
  senderPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  senderPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  receiverPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  message:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

async function rfcSender() {
  const point = fromBase64Url(rfc.senderPublic);
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwkOf(point, rfc.senderPrivate),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );

  return { publicKey: point, privateKey };
}

const receiver = { p256dh: rfc.receiverPublic, auth: rfc.authSecret };

describe("Web Push encryption", () => {
  test("produces the RFC 8291 example message from its keys and salt", async () => {
    const message = await encryptPayload(rfc.plaintext, receiver, {
      sender: await rfcSender(),
      salt: fromBase64Url(rfc.salt),
    });

    expect(toBase64Url(message)).toBe(rfc.message);
  });

  test("a fresh sender key and salt make a different message of the same length", async () => {
    const message = await encryptPayload(rfc.plaintext, receiver, {
      sender: await generateSenderKeys(),
    });

    expect(message.length).toBe(fromBase64Url(rfc.message).length);
    expect(toBase64Url(message)).not.toBe(rfc.message);
  });
});
