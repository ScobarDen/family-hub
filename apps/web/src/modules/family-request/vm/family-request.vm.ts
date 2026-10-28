import { action, computed, noop, reatomForm, wrap } from "@reatom/core";
import { z } from "zod";

import { familyNameMaxLength, type FamilyRequestStatus } from "@family-hub/contract";

import { reatomSubmitFailure } from "@/common/form";
import type { Haptics } from "@/common/telegram";

import type { FamilyRequestApi, SubmitOutcome } from "../family-request.api.ts";

export type FamilyRequestScreen =
  | { kind: "form" }
  | { kind: "sent" }
  | { kind: "already-pending" }
  | { kind: "cooldown" };

type FamilyRequestDependencies = {
  api: FamilyRequestApi;
  telegram: {
    initData: string;
    requestWriteAccess: () => Promise<boolean>;
    haptics: Pick<Haptics, "success" | "error">;
  };
  familyRequestStatus: () => FamilyRequestStatus | undefined;
  onBack: () => void;
  onCheck: () => void;
};

const familyName = z
  .string()
  .trim()
  .min(1, "Введите название семьи")
  .max(familyNameMaxLength, `Не длиннее ${familyNameMaxLength} символов`);

// What the server said at the last sign-in outranks an earlier submit: a check after a rejection
// must show the cooldown, not «Заявка отправлена».
function screenOf(
  outcome: SubmitOutcome | Error | undefined,
  known: FamilyRequestStatus | undefined,
): FamilyRequestScreen {
  if (known === "cooldown") {
    return { kind: "cooldown" };
  }

  if (typeof outcome === "string" && outcome !== "already-member") {
    return { kind: outcome };
  }

  return { kind: known === "pending" ? "already-pending" : "form" };
}

function reatomRequestForm({
  api,
  telegram,
  onCheck,
}: Pick<FamilyRequestDependencies, "api" | "telegram" | "onCheck">) {
  return reatomForm(
    { familyName: "" },
    {
      name: "familyRequest.form",
      schema: z.object({ familyName }),
      onSubmit: async (values): Promise<SubmitOutcome> => {
        // The bot can tell the requester the decision only with write access.
        await wrap(telegram.requestWriteAccess());

        const outcome = await wrap(api.submit(telegram.initData, values.familyName));

        if (outcome === "already-member") {
          onCheck();
        }

        return outcome;
      },
    },
  );
}

export function reatomFamilyRequest({
  familyRequestStatus,
  onBack,
  onCheck,
  ...dependencies
}: FamilyRequestDependencies) {
  const form = reatomRequestForm({ ...dependencies, onCheck });

  return {
    form,
    screen: computed(
      () => screenOf(form.submit.data(), familyRequestStatus()),
      "familyRequest.screen",
    ),
    isSubmitting: computed(() => !form.submit.ready(), "familyRequest.isSubmitting"),
    failure: reatomSubmitFailure(form, {
      message: "Не получилось отправить заявку. Попробуйте ещё раз.",
      name: "familyRequest.failure",
      haptics: dependencies.telegram.haptics,
    }),

    submit: action(() => {
      form.submit().then(dependencies.telegram.haptics.success, noop);
    }, "familyRequest.submit"),
    back: action(onBack, "familyRequest.back"),
    check: action(onCheck, "familyRequest.check"),
  };
}

export type FamilyRequestModel = ReturnType<typeof reatomFamilyRequest>;
