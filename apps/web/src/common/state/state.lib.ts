import { action, computed, noop, type Action } from "@reatom/core";

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
