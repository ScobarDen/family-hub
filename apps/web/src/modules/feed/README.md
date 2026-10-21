# feed

The «Лента» tab: the Family's chronology, assembled by the Worker on the fly from what the other modules keep. «Просрочено» leads with missed Plan, Subplan and Due Date deadlines, «Предстоит» shows the next 14 days — Event Occurrences, standalone Reminders, Plan deadlines, Due Dates and Pet birthdays — and the Activity follows under «Сегодня», «Вчера» and then by date: Care Entries, completed Plans and Subplans (a Plan completed by its last Subplan is one line), Contributions, Withdrawals and Completed Goals, Recipes cooked, uploads to an Album (one line per Member, Album and burst with pauses under ten minutes) and Members joining. An Activity with photos shows up to three thumbnails and «+N»; a tap opens them full screen. Private records reach only their owner. Activity comes 30 at a time; «Показать ещё» loads the next page. Chips narrow it to one module.

A Plan's deadline is ticked off right here, a Due Date gets «Записать», and a tap opens the record in its own module.

## Injected

- `api` — `createFeedApi(httpClient)`: the Feed's pages and completing a Plan or Subplan.
- `today`, `timeZone` — the viewer's date and zone for «Сегодня» and «Вчера»; still the device's.
- `onOpen` — opens a Plan, an Event, the calendar, a Pet's card, a Care Entry's form over its Pet's card, a Savings Goal, an Album or a Recipe; `app/main.tsx` switches tabs.
- `onRecord` — opens a new Care Entry that follows up a Due Date on the Pet's card.
