import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

const migrationsDirectory = join(import.meta.dirname, "..", "migrations");

type Statement = ReturnType<typeof createStatement>;

function toSqlValue(value: unknown): SQLInputValue {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return Number(value);
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  return value as SQLInputValue;
}

function createStatement(db: DatabaseSync, query: string, params: SQLInputValue[] = []) {
  return {
    bind: (...values: unknown[]) => createStatement(db, query, values.map(toSqlValue)),
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

      if (!row) {
        return null;
      }

      return column === undefined ? row : row[column];
    },
    async run() {
      const { changes, lastInsertRowid } = db.prepare(query).run(...params);

      return {
        results: [],
        success: true,
        meta: { changes, last_row_id: Number(lastInsertRowid) },
      };
    },
  };
}

async function runBatch(db: DatabaseSync, statements: Statement[]) {
  db.exec("begin");

  try {
    const results = [];

    for (const prepared of statements) {
      results.push(await prepared.all());
    }

    db.exec("commit");

    return results;
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}

function applyMigrations(db: DatabaseSync): void {
  const migrations = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .toSorted();

  for (const file of migrations) {
    db.exec(readFileSync(join(migrationsDirectory, file), "utf8"));
  }
}

export function createMigratedSqliteD1(): D1Database {
  const db = new DatabaseSync(":memory:");

  applyMigrations(db);

  const d1 = {
    prepare: (query: string) => createStatement(db, query),
    batch: (statements: Statement[]) => runBatch(db, statements),
    async exec(query: string) {
      db.exec(query);

      return { count: 0, duration: 0 };
    },
  };

  return d1 as unknown as D1Database;
}
