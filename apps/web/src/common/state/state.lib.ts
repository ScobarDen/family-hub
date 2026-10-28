import {
  action,
  atom,
  computed,
  isAbort,
  noop,
  withAsync,
  withCallHook,
  withTransaction,
  wrap,
  type Action,
} from "@reatom/core";

import { HttpError } from "@/common/http-client";
import type { Haptics } from "@/common/telegram";

// A View fires a command and reads its outcome from state, so the command's promise is not its concern.
export function detached<Params extends unknown[]>(
  command: (...params: Params) => Promise<unknown>,
  name: string,
): Action<Params, void> {
  return action((...params: Params) => {
    command(...params).catch(noop);
  }, name);
}

// Hands an atom out to read only, with no second atom in between.
export function readOnly<State>(target: () => State): () => State {
  return target;
}

// A failed command's word for the View, and an error the Member feels; the next call clears it.
export function reatomFailure(
  command: { error: () => unknown; onReject: Action },
  { message, name, haptics }: { message: string; name: string; haptics: Pick<Haptics, "error"> },
) {
  command.onReject.extend(
    withCallHook(() => {
      haptics.error();
    }),
  );

  return computed(
    (): string | undefined => (command.error() === undefined ? undefined : message),
    name,
  );
}

export const offlineFailure = "Нет связи, не сохранилось";

export function reatomRollbackFailure(name: string, haptics: Pick<Haptics, "error">) {
  const failure = atom<string | undefined>(undefined, name);

  return {
    failure: readOnly(failure),
    report: action((error: unknown, refusal: string) => {
      if (!isAbort(error)) {
        haptics.error();
        failure.set(error instanceof HttpError ? refusal : offlineFailure);
      }
    }, `${name}.report`),
    dismiss: action(() => {
      failure.set(undefined);
    }, `${name}.dismiss`),
  };
}

export type RollbackFailure = ReturnType<typeof reatomRollbackFailure>;

// The change shows at once; atoms with `withRollback` return to what they were if the server does
// not take it, and the failure bar says so.
export function reatomOptimistic<Params extends unknown[]>(
  change: (...params: Params) => Promise<void>,
  { name, failure, refusal }: { name: string; failure: RollbackFailure; refusal: string },
) {
  return action(async (...params: Params) => {
    failure.dismiss();

    try {
      await wrap(change(...params));
    } catch (error) {
      failure.report(error, refusal);
      throw error;
    }
  }, name).extend(withAsync(), withTransaction());
}

type SlideDirection = "forward" | "back";

export type Slide = (direction: SlideDirection, update: () => void) => void;

export function instantly(_direction: SlideDirection, update: () => void): void {
  update();
}
