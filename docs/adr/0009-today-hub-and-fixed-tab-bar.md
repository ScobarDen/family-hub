# The first tab is a Today hub and the tab bar has two configurable slots

A Member used to pick 2–5 of the seven modules for the tab bar (`members.tab_bar`), with the Feed first by default; the rest lived behind the Profile as hidden modules that opened without the tab bar or the microphone. Now the tab bar is `Сегодня · slot · microphone · slot · Разделы`: only the two slots are the Member's choice (Plans and Calendar by default), every module is reachable from «Разделы», and the first tab is a hub that shows what the morning digest shows — Overdue and today's Plans and Due Dates — then the next three Upcoming and one tile per module. The Feed stays the full chronology and becomes a section the hub links to.

## Decisions

- **No hidden modules.** A module screen is pushed onto the current tab's stack and always keeps the tab bar and the microphone. `/profile/modules/:module` goes away.
- **A slot's module opens its own tab.** Opened from a hub tile, «Разделы» or a record link, a module that sits in a slot switches to that tab instead of being pushed: the highlighted tab is always the one on screen, and a module's single in-memory state (an opened Plan) is never reachable from two stacks at once. Back from it goes to the tab's root, not to the hub.
- **Deep links land on the Today stack**: the hub, then the target, so Back returns to the hub whichever slots the Member chose. A Pet card gets its own `/pets/:id` route instead of an in-memory id.
- **One request for the hub.** `GET /api/today` returns the hub's blocks and every tile; each module provides its tile summary next to its Feed source, and the Overdue/today block reuses the digest's rule so the hub and the bot never disagree.
- **Migration keeps the column.** Each Member's slots become the first two non-`feed` modules of their saved `tab_bar` (else the defaults); `tab_bar` is not dropped, so the change can be rolled back.

## Considered Options

- **Keep the free 2–5 tab bar and only swap the Feed for the hub** — no migration, but hidden modules and their tab-bar-less screens stay, and a third to fifth tab leaves no room for «Разделы».
- **A fully fixed tab bar** — simplest, but takes away the one choice Members actually used.
- **The hub calling the Feed and six module endpoints** — no new endpoint, but seven requests from the Telegram WebView on every visit to the first tab.
