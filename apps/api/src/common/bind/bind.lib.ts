type TakingFirst<First> = (first: First, ...rest: never[]) => unknown;

type BoundTo<First, Functions extends Record<string, TakingFirst<First>>> = {
  [Name in keyof Functions]: Functions[Name] extends (
    first: First,
    ...rest: infer Rest
  ) => infer Result
    ? (...rest: Rest) => Result
    : never;
};

// A repository is its queries with the database filled in, a service its use cases with their
// dependencies; each is written once as a function and listed here, not wrapped by hand.
export function bindFirst<First, Functions extends Record<string, TakingFirst<First>>>(
  first: First,
  functions: Functions,
): BoundTo<First, Functions> {
  const bound = Object.fromEntries(
    Object.entries(functions).map(([name, call]) => [
      name,
      (...rest: never[]) => call(first, ...rest),
    ]),
  );

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.fromEntries drops the names the mapped type restores
  return bound as BoundTo<First, Functions>;
}
