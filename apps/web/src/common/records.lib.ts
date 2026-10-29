type Identified = { id: string };

// A saved record replaces its old copy in place, or joins the end when it is new.
export function upserted<Item extends Identified>(items: Item[], saved: Item): Item[] {
  return items.some(({ id }) => id === saved.id)
    ? items.map((item) => (item.id === saved.id ? saved : item))
    : [...items, saved];
}

export function withoutId<Item extends Identified>(items: Item[], id: string): Item[] {
  return items.filter((item) => item.id !== id);
}

type States<Item> = { beforeState: Item[]; transactionState: Item[]; currentState: Item[] };

// A rolled-back change undoes only the records it touched and nobody changed since, so another
// change made meanwhile stays; a dropped record returns to its place.
export function rolledBack<Item>(
  { beforeState, transactionState, currentState }: States<Item>,
  keyOf: (item: Item) => string,
): Item[] {
  const before = new Map(beforeState.map((item) => [keyOf(item), item]));
  const during = new Map(transactionState.map((item) => [keyOf(item), item]));
  const current = new Set(currentState.map(keyOf));
  const restored = currentState.flatMap((item) => {
    const was = before.get(keyOf(item));

    if (was === item || item !== during.get(keyOf(item))) {
      return [item];
    }

    return was === undefined ? [] : [was];
  });

  for (const [index, item] of beforeState.entries()) {
    if (!during.has(keyOf(item)) && !current.has(keyOf(item))) {
      restored.splice(index, 0, item);
    }
  }

  return restored;
}

export function rolledBackById<Item extends Identified>(states: States<Item>): Item[] {
  return rolledBack(states, ({ id }) => id);
}
