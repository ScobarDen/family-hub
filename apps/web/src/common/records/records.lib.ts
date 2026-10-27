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
