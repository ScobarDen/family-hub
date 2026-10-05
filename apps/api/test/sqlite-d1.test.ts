import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { describe, expect, test } from "vite-plus/test";

import { createMigratedSqliteD1 } from "./sqlite-d1.ts";

const pets = sqliteTable("pets", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
});

async function petsDb() {
  const d1 = createMigratedSqliteD1();

  await d1.exec(
    "create table pets (id integer primary key, name text not null, is_archived integer not null default 0)",
  );

  return drizzle(d1);
}

describe("in-memory D1 behaves like D1 under Drizzle", () => {
  test("returns inserted rows", async () => {
    const db = await petsDb();

    const inserted = await db.insert(pets).values({ name: "Бьюик" }).returning();

    expect(inserted).toEqual([{ id: 1, name: "Бьюик", isArchived: false }]);
  });

  test("reads back updated rows one by one and as values", async () => {
    const db = await petsDb();

    await db.insert(pets).values({ name: "Бьюик" });

    await db.update(pets).set({ isArchived: true }).where(eq(pets.name, "Бьюик"));

    expect(await db.select().from(pets).get()).toEqual({ id: 1, name: "Бьюик", isArchived: true });
    expect(await db.select({ name: pets.name }).from(pets).values()).toEqual([["Бьюик"]]);
  });

  test("applies a batch atomically", async () => {
    const db = await petsDb();

    await expect(
      db.batch([
        db.insert(pets).values({ id: 1, name: "Бьюик" }),
        db.insert(pets).values({ id: 1, name: "дубль" }),
      ]),
    ).rejects.toThrow("UNIQUE constraint failed: pets.id");

    expect(await db.select().from(pets)).toEqual([]);
  });
});
