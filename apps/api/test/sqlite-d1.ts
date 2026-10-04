import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

const migrationsDir = join(import.meta.dirname, "..", "migrations");

function toSqlValue(value: unknown): SQLInputValue {
  if (value === undefined) return null;
  if (typeof value === "boolean") return Number(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value as SQLInputValue;
}

export function createMigratedSqliteD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  const migrations = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }

  const statement = (query: string, params: SQLInputValue[] = []) => ({
    bind: (...values: unknown[]) => statement(query, values.map(toSqlValue)),
    async all() {
      return { results: db.prepare(query).all(...params), success: true, meta: {} };
    },
    async raw() {
      const prepared = db.prepare(query);
      prepared.setReturnArrays(true);
      return prepared.all(...params);
    },
    async first(column?: string) {
      const row = db.prepare(query).get(...params);
      if (!row) return null;
      return column ? row[column] : row;
    },
    async run() {
      const { changes, lastInsertRowid } = db.prepare(query).run(...params);
      return {
        results: [],
        success: true,
        meta: { changes, last_row_id: Number(lastInsertRowid) },
      };
    },
  });
  type Statement = ReturnType<typeof statement>;

  const d1 = {
    prepare: (query: string) => statement(query),
    async batch(statements: Statement[]) {
      db.exec("begin");
      try {
        const results = [];
        for (const prepared of statements) results.push(await prepared.all());
        db.exec("commit");
        return results;
      } catch (error) {
        db.exec("rollback");
        throw error;
      }
    },
    async exec(query: string) {
      db.exec(query);
      return { count: 0, duration: 0 };
    },
  };
  return d1 as unknown as D1Database;
}
