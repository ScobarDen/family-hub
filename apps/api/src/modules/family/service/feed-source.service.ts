import type { ActivitySource } from "@/modules/feed";

import type { FamilyRepo } from "../family.repo.ts";

export function createFamilyFeed({ families }: { families: FamilyRepo }): ActivitySource {
  return {
    before: async ({ family }, page) => {
      const rows = await families.joinsBefore(family.id, page);

      return rows.map((row) => ({
        kind: "joined",
        key: row.key,
        at: row.createdAt,
        memberName: row.memberName,
      }));
    },
  };
}
