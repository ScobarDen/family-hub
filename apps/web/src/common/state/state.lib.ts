import {
  action,
  atom,
  computed,
  isAbort,
  noop,
  withAsync,
  withTransaction,
  wrap,
  type Action,
} from "@reatom/core";

import { HttpError } from "@/common/http-client";

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

// A failed command's word for the View; the command's next call clears it.
export function reatomFailure(
  command: { error: () => unknown },
  { message, name }: { message: string; name: string },
) {
  return computed(
    (): string | undefined => (command.error() === undefined ? undefined : message),
    name,
  );
}

export const offlineFailure = "Нет связи, не сохранилось";

export function reatomRollbackFailure(name: string) {
  const failure = atom<string | undefined>(undefined, name);

  return {
    failure: readOnly(failure),
    report: action((error: unknown, refusal: string) => {
      if (!isAbort(error)) {
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
