import type { Photo, PhotoUrls, PhotoVariant } from "@family-hub/contract";

import type { Clock } from "@/common/clock";

const lifetimeMs = 86_400_000;
const hourMs = 3_600_000;
const encoder = new TextEncoder();

type PhotoOwnership = { id: string; takenAt: number | null; createdBy: string };

type Viewer = { memberId: string; isFamilyOwner: boolean };

type SignedLink = { photoId: string; variant: PhotoVariant; expiresAt: number; signature: string };

async function keyOf(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`photo-link:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function messageOf({ photoId, variant, expiresAt }: Omit<SignedLink, "signature">): Uint8Array {
  return encoder.encode(`${photoId}:${variant}:${expiresAt}`);
}

function base64UrlOf(bytes: ArrayBuffer): string {
  return btoa(String.fromCodePoint(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function bytesOf(base64Url: string): Uint8Array | undefined {
  try {
    const binary = atob(base64Url.replaceAll("-", "+").replaceAll("_", "/"));

    return Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0);
  } catch {
    return undefined;
  }
}

// Links expire on the hour, so the same photo keeps one URL — and the browser's cache — for an hour.
export function createPhotoLinks({ secret, clock }: { secret: string; clock: Clock }) {
  const key = keyOf(secret);

  async function pathOf(photoId: string, variant: PhotoVariant): Promise<string> {
    const expiresAt = Math.ceil(clock.now() / hourMs) * hourMs + lifetimeMs;
    const signature = await crypto.subtle.sign(
      "HMAC",
      await key,
      messageOf({ photoId, variant, expiresAt }),
    );

    return `/photos/${photoId}/${variant}?exp=${expiresAt}&sig=${base64UrlOf(signature)}`;
  }

  async function urlsOf(photoId: string): Promise<PhotoUrls> {
    return {
      thumb: await pathOf(photoId, "thumb"),
      medium: await pathOf(photoId, "medium"),
      full: await pathOf(photoId, "full"),
    };
  }

  return {
    urlsOf,
    // The one who uploaded a photo and the Family Owner may delete it.
    photoOf: async (row: PhotoOwnership, viewer: Viewer): Promise<Photo> => ({
      id: row.id,
      takenAt: row.takenAt,
      urls: await urlsOf(row.id),
      canDelete: viewer.isFamilyOwner || row.createdBy === viewer.memberId,
    }),
    async isValid({ signature, ...link }: SignedLink): Promise<boolean> {
      const bytes = bytesOf(signature);

      if (link.expiresAt <= clock.now() || bytes === undefined) {
        return false;
      }

      return crypto.subtle.verify("HMAC", await key, bytes, messageOf(link));
    },
  };
}

export type PhotoLinks = ReturnType<typeof createPhotoLinks>;
