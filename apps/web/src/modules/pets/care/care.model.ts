import { action, atom, computed, withAsyncData, wrap } from "@reatom/core";

import type { CareApi } from "./care.api.ts";
import { monthRange, yearRange } from "./care.lib.ts";

export type CareModelDependencies = {
  api: CareApi;
  petId: () => string | undefined;
  today: () => string;
  timeZone: () => string;
};

// Every change of a Care Entry may move the journal, the chart and both expense totals, so all
// three reload together after it.
export function reatomCareData({ api, petId, today, timeZone }: CareModelDependencies) {
  const version = atom(0, "care.version");

  return {
    entries: computed(async () => {
      version();
      const id = petId();

      return id === undefined ? [] : wrap(api.list(id));
    }, "care.entries").extend(withAsyncData()),

    dueDates: computed(async () => {
      version();
      const id = petId();

      return id === undefined ? [] : wrap(api.dueDates(id));
    }, "care.dueDates").extend(withAsyncData()),

    month: computed(async () => {
      version();
      const id = petId();

      return id === undefined ? undefined : wrap(api.expenses(id, monthRange(today(), timeZone())));
    }, "care.month").extend(withAsyncData()),

    year: computed(async () => {
      version();
      const id = petId();

      return id === undefined ? undefined : wrap(api.expenses(id, yearRange(today(), timeZone())));
    }, "care.year").extend(withAsyncData()),

    reload: action(() => {
      version.set(version() + 1);
    }, "care.reload"),
  };
}

export type CareData = ReturnType<typeof reatomCareData>;
