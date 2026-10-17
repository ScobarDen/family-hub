import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  telegramId: integer("telegram_id").notNull().unique(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerMemberId: text("owner_member_id")
    .notNull()
    .references(() => members.id),
  createdAt: integer("created_at").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => members.id),
  updatedAt: integer("updated_at").notNull(),
});

export const familyMembers = sqliteTable(
  "family_members",
  {
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.familyId, table.memberId] }),
    uniqueIndex("family_members_member_id_unique").on(table.memberId),
  ],
);

export const familyRequests = sqliteTable(
  "family_requests",
  {
    id: text("id").primaryKey(),
    telegramId: integer("telegram_id").notNull(),
    familyName: text("family_name").notNull(),
    requesterName: text("requester_name").notNull(),
    requesterUsername: text("requester_username"),
    status: text("status", { enum: ["pending", "approved", "rejected", "stale"] }).notNull(),
    createdAt: integer("created_at").notNull(),
    decidedAt: integer("decided_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("family_requests_pending_telegram_id_unique")
      .on(table.telegramId)
      .where(sql`${table.status} = 'pending'`),
  ],
);
