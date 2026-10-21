import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type { AppModule, PetSex, PetSpecies } from "@family-hub/contract";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  telegramId: integer("telegram_id").notNull().unique(),
  name: text("name").notNull(),
  // NULL until the Member customises it, so a changed default reaches everyone who never did.
  tabBar: text("tab_bar", { mode: "json" }).$type<AppModule[]>(),
  timeZone: text("time_zone"),
  isTimeZoneAuto: integer("is_time_zone_auto", { mode: "boolean" }).notNull().default(true),
  canMessage: integer("can_message", { mode: "boolean" }).notNull().default(true),
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

export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at").notNull(),
    usedAt: integer("used_at"),
    usedBy: text("used_by").references(() => members.id),
    revokedAt: integer("revoked_at"),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("invites_family_id_created_by_idx").on(table.familyId, table.createdBy)],
);

export const pets = sqliteTable(
  "pets",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    species: text("species").$type<PetSpecies>().notNull(),
    breed: text("breed"),
    sex: text("sex").$type<PetSex>(),
    birthDate: text("birth_date"),
    chipNumber: text("chip_number"),
    notes: text("notes"),
    memoFood: text("memo_food"),
    memoClinic: text("memo_clinic"),
    memoImportant: text("memo_important"),
    memoUpdatedAt: integer("memo_updated_at"),
    memoUpdatedBy: text("memo_updated_by").references(() => members.id),
    archivedAt: integer("archived_at"),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("pets_family_id_idx").on(table.familyId)],
);
