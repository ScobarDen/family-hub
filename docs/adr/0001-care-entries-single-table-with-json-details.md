# Care Entries live in one table with typed JSON details

A Pet's journal has seven Care Kinds with different fields (feeding, walk, vaccination, treatment, weight, vet visit, note). We store them all in a single `care_entries` table: shared columns, a `kind` discriminator and a `details` JSON column validated by the schema in `packages/contract`. Only the fields the app queries on are promoted to real indexed columns: `due_date` and `due_key` (for the "Скоро" block and Due Date Reminders) and `weight_kg` (for the weight chart).

## Considered Options

- **A table per Care Kind** — seven tables to join for the journal, the gallery and the "Сегодня" summary, and a migration for every new kind.
- **One wide table with nullable columns** — dozens of columns that are empty for most rows, with no type-level link between `kind` and the columns that apply to it.

## Consequences

- Adding or changing a kind-specific field is a schema change in `packages/contract`, not a D1 migration, so old rows must stay readable by the new schema.
- Any new field the app needs to filter, sort or chart on must be promoted out of `details` into a real column with a migration.
