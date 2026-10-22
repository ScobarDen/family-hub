import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type {
  AppModule,
  CareDetails,
  CommandDraft,
  CareKind,
  EventReminderOffset,
  ExpenseCategory,
  GoalColor,
  GoalIcon,
  GoalOutcome,
  MovementKind,
  PetSex,
  PetSpecies,
  PlanReminder,
  Visibility,
} from "@family-hub/contract";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  telegramId: integer("telegram_id").notNull().unique(),
  name: text("name").notNull(),
  // NULL until the Member customises it, so a changed default reaches everyone who never did.
  tabBar: text("tab_bar", { mode: "json" }).$type<AppModule[]>(),
  timeZone: text("time_zone"),
  isTimeZoneAuto: integer("is_time_zone_auto", { mode: "boolean" }).notNull().default(true),
  canMessage: integer("can_message", { mode: "boolean" }).notNull().default(true),
  isDigestEnabled: integer("is_digest_enabled", { mode: "boolean" }).notNull().default(true),
  digestTime: text("digest_time").notNull().default("09:00"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerMemberId: text("owner_member_id")
    .notNull()
    .references(() => members.id),
  photoChannelId: integer("photo_channel_id"),
  photoChannelTitle: text("photo_channel_title"),
  isPhotoChannelConnected: integer("is_photo_channel_connected", { mode: "boolean" }),
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
    avatarPhotoId: text("avatar_photo_id").references((): AnySQLiteColumn => photos.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("pets_family_id_idx").on(table.familyId)],
);

// A root Plan carries the owner and the visibility; its Subplans (parent_id set) inherit both.
export const plans = sqliteTable(
  "plans",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnySQLiteColumn => plans.id, {
      onDelete: "cascade",
    }),
    ownerMemberId: text("owner_member_id").references(() => members.id),
    visibility: text("visibility").$type<Visibility>(),
    title: text("title").notNull(),
    note: text("note"),
    dueDate: text("due_date"),
    reminder: text("reminder").$type<PlanReminder>(),
    assigneeMemberId: text("assignee_member_id").references(() => members.id),
    petId: text("pet_id").references(() => pets.id, { onDelete: "set null" }),
    albumId: text("album_id").references((): AnySQLiteColumn => albums.id, {
      onDelete: "set null",
    }),
    completedAt: integer("completed_at"),
    completedBy: text("completed_by").references(() => members.id),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("plans_family_id_idx").on(table.familyId),
    index("plans_parent_id_idx").on(table.parentId),
  ],
);

// Kind-specific fields live in details (ADR 0001); the columns below are what the app filters,
// sums or charts on.
export const careEntries = sqliteTable(
  "care_entries",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    petId: text("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    kind: text("kind").$type<CareKind>().notNull(),
    occurredAt: integer("occurred_at").notNull(),
    note: text("note"),
    details: text("details", { mode: "json" }).$type<CareDetails>().notNull(),
    dueDate: text("due_date"),
    dueKey: text("due_key"),
    weightKg: real("weight_kg"),
    expenseAmount: integer("expense_amount"),
    expenseCategory: text("expense_category").$type<ExpenseCategory>(),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("care_entries_pet_id_occurred_at_idx").on(table.petId, table.occurredAt),
    index("care_entries_family_id_idx").on(table.familyId),
  ],
);

// A timed Event keeps its wall-clock time and the zone it was set in; an all-day one has neither.
export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    ownerMemberId: text("owner_member_id").references(() => members.id),
    visibility: text("visibility").$type<Visibility>().notNull(),
    title: text("title").notNull(),
    note: text("note"),
    startDate: text("start_date").notNull(),
    startTime: text("start_time"),
    timeZone: text("time_zone"),
    endDate: text("end_date"),
    endTime: text("end_time"),
    frequency: text("frequency").$type<"weekly" | "monthly" | "yearly">(),
    until: text("until"),
    skippedDates: text("skipped_dates", { mode: "json" }).$type<string[]>().notNull().default([]),
    reminderOffsets: text("reminder_offsets", { mode: "json" })
      .$type<EventReminderOffset[]>()
      .notNull()
      .default([]),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("events_family_id_idx").on(table.familyId)],
);

export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    ownerMemberId: text("owner_member_id").references(() => members.id),
    visibility: text("visibility").$type<Visibility>().notNull(),
    text: text("text").notNull(),
    startDate: text("start_date").notNull(),
    startTime: text("start_time").notNull(),
    timeZone: text("time_zone").notNull(),
    frequency: text("frequency").$type<"weekly" | "monthly" | "yearly">(),
    until: text("until"),
    isForEveryone: integer("is_for_everyone", { mode: "boolean" }).notNull(),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("reminders_family_id_idx").on(table.familyId)],
);

export const reminderRecipients = sqliteTable(
  "reminder_recipients",
  {
    reminderId: text("reminder_id")
      .notNull()
      .references(() => reminders.id, { onDelete: "cascade" }),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
  },
  (table) => [primaryKey({ columns: [table.reminderId, table.memberId] })],
);

// A Pet's Due Dates and an Event's offsets each get their own source id, "<pet>:<entry>" and
// "<event>:<offset>", so a source's rows are found by that prefix.
export type DispatchSource = "reminder" | "event" | "pet_birthday" | "pet_due" | "plan" | "digest";

// One row per source and Recipient: services set next_fire_at whenever the source changes; the
// cron only takes due rows, sends and moves them on to the next Occurrence.
export const reminderDispatch = sqliteTable(
  "reminder_dispatch",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    source: text("source").$type<DispatchSource>().notNull(),
    sourceId: text("source_id").notNull(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    occurrence: text("occurrence"),
    nextFireAt: integer("next_fire_at"),
    sentOccurrence: text("sent_occurrence"),
    chatId: integer("chat_id"),
    messageId: integer("message_id"),
    doneAt: integer("done_at"),
    doneBy: text("done_by").references(() => members.id),
    lockedUntil: integer("locked_until"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("reminder_dispatch_next_fire_at_idx").on(table.nextFireAt),
    index("reminder_dispatch_source_idx").on(table.source, table.sourceId),
  ],
);

// Balance and Achieved are computed from the movements; only closing a Goal by hand is stored.
export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    ownerMemberId: text("owner_member_id").references(() => members.id),
    visibility: text("visibility").$type<Visibility>().notNull(),
    title: text("title").notNull(),
    target: integer("target").notNull(),
    deadline: text("deadline"),
    icon: text("icon").$type<GoalIcon>().notNull(),
    color: text("color").$type<GoalColor>().notNull(),
    note: text("note"),
    completedAt: integer("completed_at"),
    completedBy: text("completed_by").references(() => members.id),
    outcome: text("outcome").$type<GoalOutcome>(),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("goals_family_id_idx").on(table.familyId)],
);

export const goalMovements = sqliteTable(
  "goal_movements",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    kind: text("kind").$type<MovementKind>().notNull(),
    amount: integer("amount").notNull(),
    date: text("date").notNull(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    comment: text("comment"),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("goal_movements_goal_id_idx").on(table.goalId)],
);

export type PhotoVariants = { thumb: string; medium: string; full: string };

// A photo is the file_ids Telegram gave its variants; deleting it only forgets them (ADR 0002).
export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    fileUniqueId: text("file_unique_id").notNull(),
    variants: text("variants", { mode: "json" }).$type<PhotoVariants>().notNull(),
    takenAt: integer("taken_at"),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
  },
  (table) => [uniqueIndex("photos_family_file_idx").on(table.familyId, table.fileUniqueId)],
);

export const careEntryPhotos = sqliteTable(
  "care_entry_photos",
  {
    careEntryId: text("care_entry_id")
      .notNull()
      .references(() => careEntries.id, { onDelete: "cascade" }),
    photoId: text("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [primaryKey({ columns: [table.careEntryId, table.photoId] })],
);

// Albums are always Shared; a Pet's automatic Album is not stored but read from its Care Entries.
export const albums = sqliteTable(
  "albums",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    coverPhotoId: text("cover_photo_id").references(() => photos.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("albums_family_id_idx").on(table.familyId)],
);

export const albumPhotos = sqliteTable(
  "album_photos",
  {
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    photoId: text("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    addedAt: integer("added_at").notNull(),
    addedBy: text("added_by")
      .notNull()
      .references(() => members.id),
  },
  (table) => [primaryKey({ columns: [table.albumId, table.photoId] })],
);

// Recipes are always Shared: any Member edits one, its author deletes it.
export const recipes = sqliteTable(
  "recipes",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    ingredients: text("ingredients").notNull(),
    method: text("method"),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("recipes_family_id_idx").on(table.familyId)],
);

export const recipeTags = sqliteTable(
  "recipe_tags",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("recipe_tags_family_id_idx").on(table.familyId)],
);

export const recipeTagLinks = sqliteTable(
  "recipe_tag_links",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => recipeTags.id, { onDelete: "cascade" }),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.tagId] })],
);

export const recipePhotos = sqliteTable(
  "recipe_photos",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    photoId: text("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.photoId] })],
);

export const recipeFavorites = sqliteTable(
  "recipe_favorites",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.memberId] })],
);

export const recipeCooks = sqliteTable(
  "recipe_cooks",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    cookedAt: integer("cooked_at").notNull(),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
  },
  (table) => [index("recipe_cooks_recipe_id_idx").on(table.recipeId)],
);

export type CommandSource = "bot_text" | "bot_voice" | "mini_app";

export type CommandStatus = "pending" | "created" | "dismissed" | "failed";

// One row per command handled, failed ones included: it is also the Family's daily count.
export const commandDrafts = sqliteTable(
  "command_drafts",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    kind: text("kind").$type<CommandDraft["kind"]>(),
    payload: text("payload", { mode: "json" }).$type<CommandDraft>(),
    source: text("source").$type<CommandSource>().notNull(),
    chatId: integer("chat_id"),
    messageId: integer("message_id"),
    timeZone: text("time_zone"),
    status: text("status").$type<CommandStatus>().notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("command_drafts_family_created_idx").on(table.familyId, table.createdAt)],
);
