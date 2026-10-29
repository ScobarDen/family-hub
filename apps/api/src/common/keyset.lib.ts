import { and, desc, lt, lte, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";

// A position in a list ordered by `at desc, key desc`, written as "<at>.<key>".
export type Keyset = { at: number; key: string };

// One page of a keyset-ordered query: everything older than the keyset, at most `limit` rows.
export type KeysetPage = { keyset: Keyset | undefined; limit: number };

type Keyed = { at: SQLWrapper; key: SQL };

export function parseKeyset(raw: string | undefined): Keyset | undefined {
  const separator = raw?.indexOf(".") ?? -1;
  const at = Number(raw?.slice(0, separator));

  return raw === undefined || separator < 0 || !Number.isFinite(at)
    ? undefined
    : { at, key: raw.slice(separator + 1) };
}

export function formatKeyset({ at, key }: Keyset): string {
  return `${at}.${key}`;
}

// Keys compare by code unit, as SQLite's default collation does, so memory and SQL agree.
export function newestFirst(left: Keyset, right: Keyset): number {
  if (left.at !== right.at) {
    return right.at - left.at;
  }

  if (left.key === right.key) {
    return 0;
  }

  return left.key < right.key ? 1 : -1;
}

export function keyOf(prefix: string, id: SQLWrapper): SQL<string> {
  return sql<string>`${`${prefix}-`} || ${id}`;
}

// The bare `at <=` lets an index on the moment narrow the scan before the tie on key is settled.
export function olderThan({ at, key }: Keyed, keyset: Keyset | undefined): SQL | undefined {
  return keyset === undefined
    ? undefined
    : and(lte(at, keyset.at), or(lt(at, keyset.at), lt(key, keyset.key)));
}

export function newestFirstBy({ at, key }: Keyed): SQL[] {
  return [desc(at), desc(key)];
}
