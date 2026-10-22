import type { DispatchChanges, DispatchRow, MovedRow, NewRow } from "../repo/dispatch.repo.ts";

type RowKey = Pick<DispatchRow, "source" | "sourceId" | "memberId">;

export type PlannedRow = RowKey & { fire: { occurrence: string; fireAt: number } | undefined };

export function rowKey({ source, sourceId, memberId }: RowKey): string {
  return `${source}|${sourceId}|${memberId}`;
}

function isSnoozed(row: DispatchRow, now: number): boolean {
  return (
    row.sentOccurrence !== null &&
    row.occurrence === row.sentOccurrence &&
    (row.nextFireAt ?? 0) > now
  );
}

function movedOf(row: DispatchRow, { fire }: PlannedRow, now: number): MovedRow[] {
  const occurrence = fire?.occurrence ?? null;
  const nextFireAt = fire?.fireAt ?? null;
  const isSame = row.occurrence === occurrence && row.nextFireAt === nextFireAt;

  return isSame || isSnoozed(row, now) ? [] : [{ id: row.id, occurrence, nextFireAt }];
}

function addedOf({ fire, ...key }: PlannedRow): NewRow[] {
  return fire === undefined
    ? []
    : [{ ...key, occurrence: fire.occurrence, nextFireAt: fire.fireAt }];
}

// A row already there keeps what was sent, pressed and snoozed: only a changed Occurrence or fire
// time is written, a snoozed row waits for its snooze, and only the rows of a Recipient or source
// that is gone are deleted.
export function changesOf({
  existing,
  planned,
  now,
}: {
  existing: DispatchRow[];
  planned: PlannedRow[];
  now: number;
}): Pick<DispatchChanges, "added" | "moved" | "removedIds"> {
  const byKey = new Map(existing.map((row) => [rowKey(row), row]));
  const wanted = new Set(planned.map(rowKey));

  return {
    added: planned.filter((plan) => !byKey.has(rowKey(plan))).flatMap(addedOf),
    moved: planned.flatMap((plan) => {
      const row = byKey.get(rowKey(plan));

      return row === undefined ? [] : movedOf(row, plan, now);
    }),
    removedIds: existing.filter((row) => !wanted.has(rowKey(row))).map(({ id }) => id),
  };
}
