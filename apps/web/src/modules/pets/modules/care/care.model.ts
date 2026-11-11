import { rolledBackById } from "@/common/records.lib.ts";
import { reatomLiveResource } from "@/modules/live-resource";
import type { LiveVersion } from "@/modules/live-updates";

import type { CareApi } from "./care.api.ts";
import { monthRange, yearRange } from "./care.lib.ts";

export type CareModelDependencies = {
  api: CareApi;
  petId: () => string | undefined;
  today: () => string;
  timeZone: () => string;
} & LiveVersion;

function reatomExpenses(
  { api, petId, today, timeZone, liveVersion }: CareModelDependencies,
  { name, rangeOf }: { name: string; rangeOf: typeof monthRange },
) {
  return reatomLiveResource({
    name,
    liveVersion,
    load: async () => {
      const id = petId();

      return id === undefined ? undefined : api.expenses(id, rangeOf(today(), timeZone()));
    },
  });
}

// Every change of a Care Entry may move the journal, the chart and both expense totals, so all
// three follow the Pet's live version.
export function reatomCareData(dependencies: CareModelDependencies) {
  const { api, petId, liveVersion } = dependencies;
  const entries = reatomLiveResource({
    name: "care.entries",
    liveVersion,
    load: async () => {
      const id = petId();

      return id === undefined ? [] : api.list(id);
    },
    rollback: rolledBackById,
  });
  const month = reatomExpenses(dependencies, { name: "care.month", rangeOf: monthRange });
  const year = reatomExpenses(dependencies, { name: "care.year", rangeOf: yearRange });

  return { entries, month, year };
}

export type CareData = ReturnType<typeof reatomCareData>;
