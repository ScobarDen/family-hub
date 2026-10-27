import { action, atom, type Atom, computed, withAbort, withAsync, wrap } from "@reatom/core";

import { expenseCategoryTitles, type CareEntry, type CareKind } from "@family-hub/contract";

import { formatDay } from "@/common/format-date";
import { formatRubles } from "@/common/format-money";
import type { LiveVersion } from "@/common/live-updates";
import type { PreparedPhoto } from "@/common/photo";
import { detached, readOnly, reatomFailure } from "@/common/state";
import { type Dialogs, isConfirmed } from "@/common/telegram";

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

export type CareScreen =
  | { kind: "blocks" }
  | { kind: "form"; isCreating: boolean }
  | { kind: "expenses" };

export type CareDependencies = LiveVersion & {
  api: CareApi;
  petId: () => string | undefined;
  today: () => string;
  now: () => string;
  timeZone: () => string;
  telegram: Dialogs;
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

function reatomRemove({ api, data, form, screen, telegram }: Sources) {
  return action(async () => {
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

    await wrap(api.remove(entryId));
    data.reload();
    screen.set("blocks");
  }, "care.remove").extend(withAsync());
}

// «Изменить» on a Command Draft lands in the ordinary form, filled in from the draft.
function reatomDraftEditing({ form, screen }: Sources) {
  return {
    editDraft: action((opening: CareEntryDraftOpening) => {
      form.startFromDraft(opening);
      screen.set("form");
    }, "care.editDraft"),
  };
}

// A link or the Feed may name an entry before its Pet's journal has loaded, or of another Pet.
function reatomOpening({ api, data, form, screen, onOpenPet }: Sources) {
  async function entryOf(entryId: string): Promise<CareEntry> {
    return data.entries.data()?.find(({ id }) => id === entryId) ?? api.get(entryId);
  }

  const openEntry = action(async (entryId: string) => {
    const entry = await wrap(entryOf(entryId));

    onOpenPet(entry.petId);
    form.startEditing(entry);
    screen.set("form");
  }, "care.openEntryOfPet").extend(withAbort());

  return { openEntry: detached(openEntry, "care.openEntry") };
}

function reatomMoves({ data, form, screen }: Sources, weightRange: Atom<WeightRange>) {
  return {
    add: action((kind: CareKind) => {
      form.startCreating(kind);
      screen.set("form");
    }, "care.add"),
    edit: action((entryId: string) => {
      const entry = data.entries.data()?.find(({ id }) => id === entryId);

      if (entry !== undefined) {
        form.startEditing(entry);
        screen.set("form");
      }
    }, "care.edit"),
    openExpenses: action(() => {
      screen.set("expenses");
    }, "care.openExpenses"),
    chooseWeightRange: action((range: WeightRange) => {
      weightRange.set(range);
    }, "care.chooseWeightRange"),
    back: action(() => {
      screen.set("blocks");
    }, "care.back"),
  };
}

function reatomTitle(screen: Atom<CareScreen["kind"]>, form: CareFormModel) {
  return computed((): string | undefined => {
    const kind = screen();

    if (kind === "form") {
      return form.editedId() === undefined ? "Новая запись" : "Запись";
    }

    return kind === "expenses" ? "Траты" : undefined;
  }, "care.title");
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

function reatomScreen(screen: Atom<CareScreen["kind"]>, form: CareFormModel) {
  return computed((): CareScreen => {
    const kind = screen();

    return kind === "form" ? { kind, isCreating: form.editedId() === undefined } : { kind };
  }, "care.screen");
}

export function reatomCare(dependencies: CareDependencies) {
  const data = reatomCareData(dependencies);
  const screen = atom<CareScreen["kind"]>("blocks", "care.screenKind");
  const photos = reatomCarePhotos(dependencies, data);
  const form = reatomCareForm({
    ...dependencies,
    photos: photos.attachments,
    onSaved: () => {
      data.reload();
      screen.set("blocks");
    },
  });
  const sources: Sources = {
    ...dependencies,
    data,
    form,
    screen,
  };
  const weightRange = atom<WeightRange>("quarter", "care.weightRange");
  const remove = reatomRemove(sources);

  return {
    screen: reatomScreen(screen, form),
    title: reatomTitle(screen, form),
    canGoBack: computed(() => screen() !== "blocks", "care.canGoBack"),
    isReadOnly: readOnly(dependencies.isReadOnly),
    failure: reatomFailure(remove, {
      message: "Не получилось удалить запись. Попробуйте ещё раз.",
      name: "care.failure",
    }),
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
