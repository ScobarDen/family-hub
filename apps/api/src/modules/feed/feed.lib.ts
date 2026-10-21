import {
  uploadBatchGapMs,
  type CareDetails,
  type ExpenseCategory,
  type FeedActivity,
  type FeedUpcoming,
  type Photo,
} from "@family-hub/contract";

import type {
  FeedCareRow,
  FeedUploadRow,
  FeedGoalRow,
  FeedJoinRow,
  FeedMovementRow,
  FeedPlanRow,
} from "./feed.repo.ts";

export type Cursor = { at: number; key: string };

const careTitles = {
  vaccination: "Прививка",
  treatment: "Обработка",
  vet_visit: "Ветеринар",
  weight: "Вес",
  note: "Заметка",
} as const;

const expenseTitles: Record<ExpenseCategory, string> = {
  food: "Корм",
  vet: "Ветеринар",
  medicine: "Лекарства",
  grooming: "Груминг",
  toys: "Игрушки",
  other: "Другое",
};

const rubles = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function careTitleOf(details: CareDetails): string {
  if (details.kind === "vaccination") {
    return `${careTitles.vaccination}: ${details.vaccine}`;
  }

  if (details.kind === "treatment") {
    return `${careTitles.treatment}: ${details.target}`;
  }

  if (details.kind === "vet_visit") {
    return details.reason === null
      ? careTitles.vet_visit
      : `${careTitles.vet_visit}: ${details.reason}`;
  }

  if (details.kind === "weight") {
    return `${careTitles.weight}: ${details.weightKg} кг`;
  }

  return details.kind === "expense"
    ? `${expenseTitles[details.category]}: ${rubles.format(details.amount)}`
    : careTitles.note;
}

export function byDateAndTime(left: FeedUpcoming, right: FeedUpcoming): number {
  const leftTime = "time" in left ? (left.time ?? "") : "";
  const rightTime = "time" in right ? (right.time ?? "") : "";

  return left.date === right.date
    ? leftTime.localeCompare(rightTime)
    : left.date.localeCompare(right.date);
}

type PlanTree = { root: FeedPlanRow; steps: FeedPlanRow[] };

// A Private Plan exists only for its owner, its Subplans included.
export function visibleTrees(rows: FeedPlanRow[], memberId: string): PlanTree[] {
  return rows
    .filter(
      ({ parentId, visibility, ownerMemberId }) =>
        parentId === null && (visibility !== "private" || ownerMemberId === memberId),
    )
    .map((root) => ({
      root,
      steps: [root, ...rows.filter(({ parentId }) => parentId === root.id)],
    }));
}

export function stepTitle(root: FeedPlanRow, step: FeedPlanRow): string {
  return step.id === root.id ? root.title : `${root.title}: ${step.title}`;
}

// The last Subplan completes its Plan at the same moment; the two make one line.
export function planActivity(trees: PlanTree[]): FeedActivity[] {
  return trees.flatMap(({ root, steps }) =>
    steps
      .filter(
        (step) =>
          step.completedAt !== null &&
          (step.id === root.id || step.completedAt !== root.completedAt),
      )
      .map((step) => ({
        kind: "plan" as const,
        key: `plan-${step.id}`,
        at: step.completedAt ?? 0,
        memberName: step.completedByName ?? "",
        title: stepTitle(root, step),
        planId: root.id,
      })),
  );
}

export type PhotoPreview = { photos: Photo[]; photoCount: number };

const noPhotos: PhotoPreview = { photos: [], photoCount: 0 };

export function careActivity(
  rows: FeedCareRow[],
  { petNames, previews }: { petNames: Map<string, string>; previews: Map<string, PhotoPreview> },
): FeedActivity[] {
  return rows.map((row) => ({
    kind: "care",
    key: `care-${row.id}`,
    at: row.createdAt,
    memberName: row.memberName,
    title: `${careTitleOf(row.details)} — ${petNames.get(row.petId) ?? ""}`,
    petId: row.petId,
    entryId: row.id,
    ...(previews.get(row.id) ?? noPhotos),
  }));
}

const outcomeTitles = { fulfilled: "Цель исполнена", cancelled: "Цель отменена" } as const;

function movementActivity(movements: FeedMovementRow[], visible: Map<string, FeedGoalRow>) {
  return movements.flatMap((movement): FeedActivity[] => {
    const goal = visible.get(movement.goalId);
    const sign = movement.kind === "contribution" ? "+" : "−";

    return goal === undefined
      ? []
      : [
          {
            kind: "goal",
            key: `movement-${movement.id}`,
            at: movement.createdAt,
            memberName: movement.memberName,
            title: `${sign}${rubles.format(movement.amount)} · ${goal.title}`,
            goalId: goal.id,
          },
        ];
  });
}

function closedGoalActivity(goals: FeedGoalRow[]): FeedActivity[] {
  return goals.flatMap((goal): FeedActivity[] =>
    goal.completedAt === null || goal.outcome === null
      ? []
      : [
          {
            kind: "goal",
            key: `goal-${goal.id}`,
            at: goal.completedAt,
            memberName: goal.completedByName ?? "",
            title: `${outcomeTitles[goal.outcome]}: ${goal.title}`,
            goalId: goal.id,
          },
        ],
  );
}

// A Private Goal and its money exist only for its owner.
export function goalActivity(
  { goals, movements }: { goals: FeedGoalRow[]; movements: FeedMovementRow[] },
  memberId: string,
): FeedActivity[] {
  const visible = goals.filter(
    ({ visibility, ownerMemberId }) => visibility !== "private" || ownerMemberId === memberId,
  );

  return [
    ...movementActivity(movements, new Map(visible.map((goal) => [goal.id, goal]))),
    ...closedGoalActivity(visible),
  ];
}

export function joinActivity(rows: FeedJoinRow[]): FeedActivity[] {
  return rows.map((row) => ({
    kind: "joined",
    key: `joined-${row.memberId}`,
    at: row.createdAt,
    memberName: row.memberName,
  }));
}

function isBefore(item: FeedActivity, cursor: Cursor | undefined): boolean {
  return (
    cursor === undefined || item.at < cursor.at || (item.at === cursor.at && item.key < cursor.key)
  );
}

function newestFirst(left: FeedActivity, right: FeedActivity): number {
  return left.at === right.at ? right.key.localeCompare(left.key) : right.at - left.at;
}

export function pageOf(
  items: FeedActivity[],
  { cursor, size }: { cursor: Cursor | undefined; size: number },
): { activity: FeedActivity[]; next: string | null } {
  const older = items.filter((item) => isBefore(item, cursor)).toSorted(newestFirst);
  const activity = older.slice(0, size);
  const last = activity.at(-1);

  return {
    activity,
    next: older.length > size && last !== undefined ? `${last.at}.${last.key}` : null,
  };
}

export function parseCursor(raw: string | undefined): Cursor | undefined {
  const separator = raw?.indexOf(".") ?? -1;
  const at = Number(raw?.slice(0, separator));

  return raw === undefined || separator < 0 || !Number.isFinite(at)
    ? undefined
    : { at, key: raw.slice(separator + 1) };
}

export type UploadBatch = {
  key: string;
  albumId: string;
  albumTitle: string;
  memberName: string;
  at: number;
  photos: Array<FeedUploadRow["photo"]>;
};

// One Member's uploads to one Album make a batch while the pauses between them stay short.
export function uploadBatchesOf(rows: FeedUploadRow[]): UploadBatch[] {
  const batches: UploadBatch[] = [];
  const open = new Map<string, UploadBatch>();

  for (const row of rows.toSorted((left, right) => left.addedAt - right.addedAt)) {
    const group = `${row.albumId}:${row.addedBy}`;
    const batch = open.get(group);

    if (batch !== undefined && row.addedAt - batch.at < uploadBatchGapMs) {
      batch.at = row.addedAt;
      batch.photos.push(row.photo);
    } else {
      const started: UploadBatch = {
        key: `upload-${group}-${row.addedAt}`,
        albumId: row.albumId,
        albumTitle: row.albumTitle,
        memberName: row.memberName,
        at: row.addedAt,
        photos: [row.photo],
      };

      open.set(group, started);
      batches.push(started);
    }
  }

  return batches;
}
