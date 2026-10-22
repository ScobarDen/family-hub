# The Feed merges Activity and Upcoming from the modules that own them

The Feed used to read the tables of about eight modules itself, and only Care Entries honoured the page cursor: Plans, Contributions, joins, uploads and Cooked marks were loaded whole on every page and cut in memory. Now every owning module exposes a source, and the Feed only merges, sorts and cuts the page. The Feed reads no tables.

## Decisions

- **Two source shapes, injected by the composition root.** `ActivitySource.before(viewer, cursor, limit)` returns up to `limit` contract-shaped `FeedActivity` items older than the cursor, newest first. `UpcomingSource.within(viewer, window)` returns the `FeedUpcoming` items due by the window's last day, overdue ones included, and the Feed splits them into Overdue and Upcoming. `createWorker` hands the Feed service one array of each, so the Feed imports no module and a new kind needs its contract shape, its source in the owning module and one line in `worker.ts`.
- **Sources return finished items.** Titles, money formatting, photo previews and per-kind rules (the last Subplan merging with its Plan's completion) live with the owner. The Feed knows only `at` and `key`.
- **One keyset cursor `"<at>.<key>"` over the mixed feed.** Every source orders by `at desc, key desc` and filters `at < cursor.at or (at = cursor.at and key < cursor.key)` in SQL against the same key expression it emits (`'care-' || id`), then returns `pageSize + 1` items. The Feed merges them, takes `pageSize` and sets `next` from the last one. The cursor format and the API stay unchanged.
- **Sources apply Private visibility.** The viewer reaches the source, which filters in SQL, so a hidden record never takes a slot on the page.
- **Upload Batches are stored, not computed.** A batch computed from gaps between `album_photos` rows splits at a page boundary and comes back as a duplicate. `album_upload_batches` keeps one row per batch with `last_added_at`; adding photos continues the Member's latest batch in that Album when it is younger than `uploadBatchGapMs`, otherwise starts a new one, and removing a batch's last photo removes the batch. Existing rows are grouped by the same rule in the migration. The Activity key becomes `upload-<batchId>`.
- **Cross-module reads move to the owners.** The care-entry source joins `pets` for the Pet's name; the `feed` exception in `apps/api/AGENTS.md` is replaced by these joins.

## Considered Options

- **A composite cursor holding each source's position** — simpler tie-breaking, but a fatter cursor, a contract change, and sources could not overfetch.
- **Sources returning raw rows with visibility fields** — keeps rendering in one place, but the Feed keeps knowing every kind, and filtering after paging leaves short pages.
- **Upload Batch as one add request** — no lookup on insert, but a Member adding photos in two quick requests would fill the Feed with lines, which the gap rule exists to prevent.
- **Computing a batch's moment as `max(added_at)` over a `batch_id` column** — no new table, but no index serves the keyset, so the page scans every photo of the Family again.
