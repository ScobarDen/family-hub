import { action, atom, computed, withAbort, withAsync, wrap, type Atom } from "@reatom/core";

import type { CareEntry, CareKind } from "@family-hub/contract";

import { formatDay } from "@/common/format-date";
import { formatRubles } from "@/common/format-money";
import type { PreparedPhoto } from "@/common/photo";
import { detached, readOnly, reatomFailure } from "@/common/state";
import type { Dialogs } from "@/common/telegram";

import type { CareApi } from "../care.api.ts";
import { categoryTitles, type WeightRange } from "../care.config.ts";
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

type CareDependencies = {
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

export type DueSource = { id: string; title: string; dueDate: string; kind: "due" };

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
  const { data, timeZone } = sources;

  return {
    ...reatomWeight(sources, weightRange),
    journal: computed(
      (): JournalItem[] =>
        (data.entries.data() ?? []).map((entry) => toJournalItem(entry, timeZone())),
      "care.journal",
    ),
    month: computed((): ExpensesView | undefined => {
      const summary = data.month.data();

      return summary === undefined ? undefined : toExpensesView(summary);
    }, "care.monthView"),
    year: computed((): YearExpenses | undefined => {
      const summary = data.year.data();

      return summary === undefined
        ? undefined
        : {
            ...toExpensesView(summary),
            entries: summary.entries.map(({ id, category, occurredAt, amount }) => ({
              id,
              title: categoryTitles[category],
              subtitle: formatDay(occurredAt, timeZone()),
              amount: formatRubles(amount),
            })),
          };
    }, "care.yearView"),
  };
}

function reatomRemove({ api, data, form, screen, telegram }: Sources) {
  return action(async () => {
    const entryId = form.editedId();
    const choice = await wrap(
      telegram.showPopup({
        title: "Удалить запись?",
        message: "Запись пропадёт из журнала и трат у всей семьи.",
        buttons: [
          { id: "delete", type: "destructive", text: "Удалить" },
          { id: "cancel", type: "cancel" },
        ],
      }),
    );

    if (entryId === undefined || choice !== "delete") {
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
  const followUp = action(async (entryId: string) => {
    const entry = await wrap(entryOf(entryId));

    form.startFollowUp(entry);
    screen.set("form");
  }, "care.followUpEntry").extend(withAbort());

  return {
    openEntry: detached(openEntry, "care.openEntry"),
    followUp: detached(followUp, "care.followUp"),
  };
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

// The pet card shows the open Due Dates in «Скоро»; this module stays their only source.
function reatomDueSources(data: CareData) {
  return computed(
    (): DueSource[] =>
      (data.dueDates.data() ?? []).map(({ entryId, label, dueDate }) => ({
        id: entryId,
        title: label,
        dueDate,
        kind: "due",
      })),
    "care.dueSources",
  );
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
    dueSources: reatomDueSources(data),
    failure: reatomFailure(remove, {
      message: "Не получилось удалить запись. Попробуйте ещё раз.",
      name: "care.failure",
    }),
    form,
    ...photos,
    ...reatomViews(sources, weightRange),
    ...reatomMoves(sources, weightRange),
    ...reatomOpening(sources),
    ...reatomDraftEditing(sources),
    remove: detached(remove, "care.removeEntry"),
    reload: data.reload,
  };
}

export type CareModel = ReturnType<typeof reatomCare>;
