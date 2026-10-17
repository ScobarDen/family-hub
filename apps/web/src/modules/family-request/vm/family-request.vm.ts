import { action, computed, noop, reatomForm, wrap } from "@reatom/core";
import { z } from "zod";

import { familyNameMaxLength } from "@family-hub/contract";

import type { FamilyRequestApi, SubmitOutcome } from "../family-request.api.ts";

export type FamilyRequestScreen =
  | { kind: "form" }
  | { kind: "sent" }
  | { kind: "already-pending" }
  | { kind: "cooldown" };

type FamilyRequestDependencies = {
  api: FamilyRequestApi;
  telegram: { initData: string; requestWriteAccess: () => Promise<boolean> };
  onBack: () => void;
  onCheck: () => void;
};

const familyName = z
  .string()
  .trim()
  .min(1, "Введите название семьи")
  .max(familyNameMaxLength, `Не длиннее ${familyNameMaxLength} символов`);

function screenOf(outcome: SubmitOutcome | Error | undefined): FamilyRequestScreen {
  if (outcome === undefined || outcome instanceof Error || outcome === "already-member") {
    return { kind: "form" };
  }

  return { kind: outcome };
}

export function reatomFamilyRequest({ api, telegram, onBack, onCheck }: FamilyRequestDependencies) {
  const form = reatomForm(
    { familyName: "" },
    {
      name: "familyRequest.form",
      schema: z.object({ familyName }),
      onSubmit: async (values): Promise<SubmitOutcome> => {
        // The bot can tell the requester the Operator's decision only with write access.
        await wrap(telegram.requestWriteAccess());

        const outcome = await wrap(api.submit(telegram.initData, values.familyName));

        if (outcome === "already-member") {
          onCheck();
        }

        return outcome;
      },
    },
  );

  return {
    form,
    screen: computed(() => screenOf(form.submit.data()), "familyRequest.screen"),
    isSubmitting: computed(() => !form.submit.ready(), "familyRequest.isSubmitting"),
    failure: computed((): string | undefined => {
      const isRejectedByServer =
        form.submit.error() !== undefined && form.validation().errors.length === 0;

      return isRejectedByServer ? "Не получилось отправить заявку. Попробуйте ещё раз." : undefined;
    }, "familyRequest.failure"),

    submit: action(() => {
      // A failure stays in form.submit.error() and shows up as `failure`.
      form.submit().catch(noop);
    }, "familyRequest.submit"),
    back: action(onBack, "familyRequest.back"),
    check: action(onCheck, "familyRequest.check"),
  };
}

export type FamilyRequestModel = ReturnType<typeof reatomFamilyRequest>;
