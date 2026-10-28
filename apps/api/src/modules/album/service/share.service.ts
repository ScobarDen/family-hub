import type { Membership } from "@/common/auth";

import { photoCard } from "../album.lib.ts";
import type { AlbumDependencies, ShareResult } from "../album.types.ts";
import { sourceOf } from "./album-read.service.ts";

export async function sharePhoto(
  dependencies: AlbumDependencies,
  membership: Membership,
  { albumId, photoId }: { albumId: string; photoId: string },
): Promise<ShareResult> {
  const album = await sourceOf(dependencies, membership, albumId);

  if (album === undefined) {
    return { status: "not-found" };
  }

  const photo = album.photos.find(({ id }) => id === photoId);

  if (photo === undefined) {
    return { status: "photo-not-in-album" };
  }

  const prepared = await dependencies.bot.call("savePreparedInlineMessage", {
    user_id: membership.member.telegramId,
    result: photoCard(photo, {
      albumTitle: album.title,
      link: await dependencies.appLinks.appLink({ kind: "album", id: albumId }),
    }),
    allow_user_chats: true,
    allow_group_chats: true,
  });

  return { status: "ok", preparedMessageId: prepared.id };
}
