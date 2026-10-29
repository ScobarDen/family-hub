import type { ExpenseRow } from "../care.lib.ts";

export function ExpenseRows({ rows }: { rows: ExpenseRow[] }) {
  if (rows.length === 0) {
    return <p className="px-4 pb-4 text-subhead text-muted-foreground">В этом месяце трат нет</p>;
  }

  return (
    <ul className="flex flex-col px-4 pb-2">
      {rows.map((row) => (
        <li
          key={row.title}
          className="flex min-h-10 items-center justify-between gap-3 border-t border-border/60 text-subhead"
        >
          <span>{row.title}</span>
          <span className="text-right">{row.amount}</span>
        </li>
      ))}
    </ul>
  );
}
