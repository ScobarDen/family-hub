import {
  action,
  atom,
  type Atom,
  type BooleanAtom,
  computed,
  reatomBoolean,
  withAbort,
  wrap,
} from "@reatom/core";

import { expenseCategoryTitles, type CareEntry, type CareKind } from "@family-hub/contract";

import { formatDay } from "@/common/format-date.lib.ts";
import { formatRubles } from "@/common/format-money.lib.ts";
import { withoutId } from "@/common/records.lib.ts";
import { reatomFormBack } from "@/modules/form";
import type { LiveVersion } from "@/modules/live-updates";
import type { PreparedPhoto } from "@/modules/photo";
import {
  detached,
  readOnly,
  reatomOptimistic,
  reatomRollbackFailure,
  type RollbackFailure,
} from "@/modules/state";
import {
  type ClosingConfirmation,
  type Dialogs,
  type Fullscreen,
  isConfirmed,
  type Haptics,
} from "@/modules/telegram";

import type { CareApi } from "../care.api.ts";
import type { WeightRange } from "../care.config.ts";
import {
  toExpensesView,
  toJournalItem,
  weightPoints,
  weightSummaryOf,
  type ExpensesView,
  type JournalItem,
  type WeightPoint,
  type WeightSummary,
} from "../care.lib.ts";
import { reatomCareData, type CareData } from "../care.model.ts";
import { reatomCareForm, type CareEntryDraftOpening, type CareFormModel } from "./care-form.vm.ts";
import { reatomCarePhotos } from "./care-photos.vm.ts";

export type CareScreen = { kind: "blocks" } | { kind: "expenses" };

export type CareDependencies = LiveVersion & {
  api: CareApi;
  petId: () => string | undefined;
  today: () => string;
  now: () => string;
  timeZone: () => string;
  telegram: Dialogs & Fullscreen & ClosingConfirmation & { haptics: Haptics };
  isReadOnly: () => boolean;
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  // Why photos cannot be added now, from photo-storage; undefined when they can.
  photoHint: () => string | undefined;
  onMakeAvatar: (photoId: string) => void;
  onOpenPet: (petId: string) => void;
  onDraftSaved: (draftId: string) => void;
};

// What the pet card's summary leads with; the month reads as nothing spent until it arrives.
export type CareSummary = {
  weight: string | undefined;
  monthExpenses: string;
};

export type YearExpenses = ExpensesView & {
  entries: Array<{ id: string; title: string; subtitle: string; amount: string }>;
};

type Sources = CareDependencies & {
  data: CareData;
  form: CareFormModel;
  screen: Atom<CareScreen["kind"]>;
  isFormOpen: BooleanAtom;
};

function reatomWeight({ data, timeZone, today }: Sources, weightRange: Atom<WeightRange>) {
  const weight = computed(
    (): { range: WeightRange; points: WeightPoint[] } => ({
      range: weightRange(),
      points: weightPoints(data.entries.data() ?? [], {
        range: weightRange(),
        today: today(),
        timeZone: timeZone(),
      }),
    }),
    "care.weight",
  );

  return {
    weight,
    weightSummary: computed(
      (): WeightSummary | undefined => weightSummaryOf(weight().points),
      "care.weightSummary",
    ),
  };
}

function reatomViews(sources: Sources, weightRange: Atom<WeightRange>) {
  const { data, timeZone, today } = sources;

  return {
    ...reatomWeight(sources, weightRange),
    journal: computed(
      (): JournalItem[] =>
        (data.entries.data() ?? []).map((entry) =>
          toJournalItem(entry, { timeZone: timeZone(), today: today() }),
        ),
      "care.journal",
    ),
    // Until the month arrives it reads as nothing spent.
    month: computed((): ExpensesView => {
      const summary = data.month.data();

      return summary === undefined ? { total: formatRubles(0), rows: [] } : toExpensesView(summary);
    }, "care.monthView"),
    year: computed((): YearExpenses | undefined => {
      const summary = data.year.data();

      return summary === undefined
        ? undefined
        : {
            ...toExpensesView(summary),
            entries: summary.entries.map(({ id, category, occurredAt, amount }) => ({
              id,
              title: expenseCategoryTitles[category],
              subtitle: formatDay(occurredAt, { timeZone: timeZone(), today: today() }),
              amount: formatRubles(amount),
            })),
          };
    }, "care.yearView"),
  };
}

// The entry leaves the journal at once; the expenses are the server's to count, so they follow.
function reatomRemove(
  { api, data, form, isFormOpen, telegram }: Sources,
  failure: RollbackFailure,
) {
  return reatomOptimistic(
    async () => {
      const entryId = form.editedId();
      const isSure = await wrap(
        isConfirmed(telegram, {
          title: "Удалить запись?",
          message: "Запись пропадёт из журнала и трат у всей семьи.",
          button: "Удалить",
        }),
      );

      if (entryId === undefined || !isSure) {
        return;
      }

      data.entries.data.set(withoutId(data.entries.data() ?? [], entryId));
      isFormOpen.setFalse();
      await wrap(api.remove(entryId));
      data.reload();
    },
    {
      name: "care.remove",
      failure,
      refusal: "Не получилось удалить запись. Попробуйте ещё раз.",
    },
  );
}

// «Изменить» on a Command Draft lands in the ordinary form, filled in from the draft.
function reatomDraftEditing({ form, isFormOpen }: Sources) {
  return {
    editDraft: action((opening: CareEntryDraftOpening) => {
      form.startFromDraft(opening);
      isFormOpen.setTrue();
    }, "care.editDraft"),
  };
}

// A link or the Feed may name an entry before its Pet's journal has loaded, or of another Pet.
function reatomOpening({ api, data, form, isFormOpen, onOpenPet }: Sources) {
  async function entryOf(entryId: string): Promise<CareEntry> {
    return data.entries.data()?.find(({ id }) => id === entryId) ?? api.get(entryId);
  }

  const openEntry = action(async (entryId: string) => {
    const entry = await wrap(entryOf(entryId));

    onOpenPet(entry.petId);
    form.startEditing(entry);
    isFormOpen.setTrue();
  }, "care.openEntryOfPet").extend(withAbort());

  return { openEntry: detached(openEntry, "care.openEntry") };
}

function reatomBack({
  screen,
  isFormOpen,
  telegram,
}: Pick<Sources, "screen" | "isFormOpen" | "telegram">) {
  return reatomFormBack({
    name: "care.back",
    telegram,
    isFormOpen,
    back: () => {
      if (isFormOpen()) {
        isFormOpen.setFalse();
      } else {
        screen.set("blocks");
      }
    },
  });
}

function reatomMoves(
  { data, form, screen, isFormOpen, telegram }: Sources,
  weightRange: Atom<WeightRange>,
) {
  return {
    add: action((kind: CareKind) => {
      form.startCreating(kind);
      isFormOpen.setTrue();
    }, "care.add"),
    // «Записать» on a Pet's Task opens the entry filled in from what the Task was.
    addFromTask: action((taskTitle: string) => {
      form.startFromTask(taskTitle);
      isFormOpen.setTrue();
    }, "care.addFromTask"),
    edit: action((entryId: string) => {
      const entry = data.entries.data()?.find(({ id }) => id === entryId);

      if (entry !== undefined) {
        form.startEditing(entry);
        isFormOpen.setTrue();
      }
    }, "care.edit"),
    openExpenses: action(() => {
      screen.set("expenses");
    }, "care.openExpenses"),
    chooseWeightRange: action((range: WeightRange) => {
      telegram.haptics.select();
      weightRange.set(range);
    }, "care.chooseWeightRange"),
    back: reatomBack({ screen, isFormOpen, telegram }),
  };
}

// The entry form opens over the blocks or the year's expenses, which stay shown under it.
function reatomScreenState({ screen, form, isFormOpen }: Sources) {
  return {
    screen: computed((): CareScreen => ({ kind: screen() }), "care.screen"),
    isFormOpen: readOnly(isFormOpen),
    canGoBack: computed(() => isFormOpen() || screen() !== "blocks", "care.canGoBack"),
    title: computed(
      (): string | undefined => (screen() === "expenses" ? "Траты" : undefined),
      "care.title",
    ),
    formTitle: computed(
      () => (form.editedId() === undefined ? "Новая запись" : "Запись"),
      "care.formTitle",
    ),
  };
}

function reatomSummary(views: {
  weightSummary: () => WeightSummary | undefined;
  month: () => ExpensesView;
}) {
  return computed(
    (): CareSummary => ({
      weight: views.weightSummary()?.latest,
      monthExpenses: views.month().total,
    }),
    "care.summary",
  );
}

function reatomSummarizedViews(sources: Sources, weightRange: Atom<WeightRange>) {
  const views = reatomViews(sources, weightRange);

  return { ...views, summary: reatomSummary(views) };
}

export function reatomCare(dependencies: CareDependencies) {
  const data = reatomCareData(dependencies);
  const screen = atom<CareScreen["kind"]>("blocks", "care.screenKind");
  const isFormOpen = reatomBoolean(false, "care.isFormOpen");
  const failure = reatomRollbackFailure("care.failure", dependencies.telegram.haptics);
  const photos = reatomCarePhotos({ ...dependencies, failure }, data);
  const form = reatomCareForm({
    ...dependencies,
    photos: photos.attachments,
    haptics: dependencies.telegram.haptics,
    closingConfirmation: dependencies.telegram,
    onSaved: () => {
      data.reload();
      isFormOpen.setFalse();
    },
  });
  const sources: Sources = {
    ...dependencies,
    data,
    form,
    screen,
    isFormOpen,
  };
  const weightRange = atom<WeightRange>("quarter", "care.weightRange");
  const remove = reatomRemove(sources, failure);

  return {
    ...reatomScreenState(sources),
    isReadOnly: readOnly(dependencies.isReadOnly),
    failure: failure.failure,
    dismissFailure: failure.dismiss,
    form,
    ...photos,
    ...reatomSummarizedViews(sources, weightRange),
    ...reatomMoves(sources, weightRange),
    ...reatomOpening(sources),
    ...reatomDraftEditing(sources),
    remove: detached(remove, "care.removeEntry"),
    reload: data.reload,
  };
}

export type CareModel = ReturnType<typeof reatomCare>;
