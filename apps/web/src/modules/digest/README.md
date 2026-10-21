# digest

The morning digest in the Profile: on by default at 09:00 on the Member's own clock. The bot then sends what is overdue and what falls today — Event Occurrences, Plan and Subplan deadlines, Reminders, Pet birthdays and Due Dates the Member may see — with «Открыть ленту», and stays silent on a day with nothing to say. A change shows at once and is saved right away.

## Injected

- `api` — `createDigestApi(httpClient)`: saving the switch and the time.
- `saved` — the Member's digest settings from the session.
