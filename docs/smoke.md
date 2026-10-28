# Manual smoke run

The Worker harness covers behaviour; it cannot reach real bindings, real cron delivery or Telegram itself. Run this checklist on the **dev bot** (`@scobar_family_hub_dev_bot`) before merging a PR that touches the cron, the bot webhook or bot messages. Never point the production bot at a local Worker.

## Setup

Bring up the Worker, the Mini App and the tunnel on the dev bot as in [docs/dev.md](dev.md), with the webhook and the menu button pointed at the tunnel. A cron tick is fired by hand: `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"`.

## Checklist

### Worker

- [ ] `GET $TUNNEL_URL/api/health` answers `{"status":"ok"}`.
- [ ] `OPTIONS $TUNNEL_URL/api/session` with `Origin: https://evil.example` gets no `Access-Control-Allow-Origin`.
- [ ] `POST $TUNNEL_URL/bot/webhook` without the `X-Telegram-Bot-Api-Secret-Token` header answers 401.

### Bot

- [ ] `/start` gets an answer from the bot.
- [ ] The menu button and «Открыть» open the Mini App and it signs in a Member.
- [ ] A Telegram account that is not a Member sees «Family Hub работает по приглашениям», and `members` stays empty for it.
- [ ] Colours follow the Telegram theme, light and dark.
- [ ] `getWebhookInfo` shows no `last_error_message` after the steps above.

### Cron

- [ ] A tick with nothing due sends nothing and logs no error.
- [ ] A Reminder due now arrives within one tick, exactly once to each Recipient.
- [ ] A second tick right after does not repeat it.
- [ ] A Recipient who blocked the bot is skipped and the others still get the message.
- [ ] The morning digest arrives at the Member's time and an empty one is not sent.

### Reminder buttons

- [ ] A Task's Reminder shows «✅ Готово» (green) · «⏰ Отложить» in the first row and «Открыть» in the second, in Telegram on iOS, Android and desktop.
- [ ] «✅ Готово» closes the Reminder for everyone and edits the other Recipients' messages.
- [ ] «⏰ Отложить» postpones only the pressing Recipient's copy; a new message arrives after the delay (move the clock with a manual tick).
- [ ] A button pressed by someone who is not that message's Recipient changes nothing and shows an alert.
- [ ] «⏰ Отложить» comes back in an hour for a timed Task and in a day for a Task without a time.
- [ ] A Pet-linked Task's Reminder also has «📝 Записать»: it opens the Mini App, completes that Occurrence and opens a Care Entry for the Pet.
- [ ] «Открыть» opens the Mini App on that Task, from a private chat and from a group the Reminder was forwarded to.

### Voice and commands

Run on the dev bot with the real `AI` binding (`wrangler dev --remote`), since the models answer only on Cloudflare.

- [ ] «напомни в пятницу в 19:00 оплатить интернет» answers with «⏰ Оплатить интернет · пт <date>, 19:00 · в момент · напомнить мне» and «Создать / ×» within a few seconds, with «печатает…» meanwhile.
- [ ] «Создать» creates the Task: it shows in «Дела» and the bot sends its Reminder at the time; the preview turns into «✅ Создано».
- [ ] «напомни мне завтра в 9 позвонить врачу» makes a Private Task that reminds the speaker only.
- [ ] A phrase without a subject shows «Не хватает: что за дело» and no «Создать»; nonsense answers «Не понял» with examples; «удали все напоминания» is refused.
- [ ] After `AI_COMMANDS_PER_FAMILY_DAY` commands the bot says commands are over for today, without calling the model.
- [ ] A voice message from a phone, «напомни в пятницу в семь вечера оплатить интернет», answers with «🎙 «…»» over the same preview, and «Создать» creates the Task.
- [ ] A voice message over 30 seconds is turned down at once; a silent one answers «Не расслышал».
- [ ] `wrangler tail` shows the voice command's CPU time within 10 ms.
- [ ] «Изменить» in the bot's preview opens the Mini App on the Task form filled from the draft; saving it turns the preview into «✅ Создано».
- [ ] «в субботу в 12 груминг Бьюика, напомни за день» answers «⏰ Груминг Бьюика · сб <date>, 12:00 · за день · напомнить мне · Бьюик»; «Создать» puts it in «Дела» and the Reminder arrives a day before.
- [ ] «Бьюику сделали прививку от бешенства, 1800 рублей, следующая через год» previews a vaccination with its cost, «повторить <date>» and the photo hint; «Создать» puts it in the journal and the month's expenses and adds a Task for the Pet on that date, assigned to the speaker.
- [ ] «Бьюик весит 12,4» becomes a weight entry and shows on the chart; «вчера купили корм за 3200» is dated yesterday; with two Pets, a phrase without a name asks which Pet with buttons.
- [ ] «каждый год 3 марта день рождения мамы» becomes a yearly Task without a time or Assignees; «Изменить» on it opens the Task form.

### Microphone in the Mini App

Each item on iOS, Android and Telegram Desktop.

- [ ] Holding the microphone records with a running timer and a haptic tick; releasing shows the preview sheet with the heard phrase, and «Создать» creates the Reminder.
- [ ] The very first hold asks for the microphone and sends nothing, saying «Держите кнопку и говорите»; the next hold records.
- [ ] Later holds record without asking again, Android included; after the Mini App is minimised and reopened it may ask once more.
- [ ] Sliding the finger off the button cancels: no sheet, no request in the network log.
- [ ] Holding for 30 seconds stops and sends by itself.
- [ ] While the finger is down, dragging it downwards neither scrolls the page nor closes the Mini App; after release the swipe-to-close works again.
- [ ] With the microphone refused in the system settings, the button opens the bot chat and says to send a voice message there.
- [ ] «Изменить» in the sheet opens the Reminder form filled from the draft; «×» closes the sheet.
- [ ] The draft sheet shows «Создать» and «Изменить» as Telegram's own bottom buttons, not inside the sheet; «Создать» spins in Telegram's progress until «Создано», then both buttons go away; «×» on a draft takes them away too.
- [ ] On Telegram older than 7.10 (or in Telegram Web K) both buttons sit inside the sheet, and «Создать» shows a spinner the same width as its label.

### Buttons

- [ ] With the network throttled, «Сохранить» in a Task form, «Отправить заявку», «Вступить» and «Удалить навсегда» keep their size, show a spinner over an invisible label, and cannot be pressed again until the answer; the screen reader reads them as busy.
- [ ] «Пригласить в семью» keeps its title and shows a spinner at the row's end while the Invite is made.

### Date and time fields

Each item on iOS and Android, in the light and the dark theme.

- [ ] Every date field in the Task, Subtask, Savings Goal, Contribution, Pet profile and care forms, «Когда приготовили» and «Время сводки» show a calendar or clock icon and no native arrow; a date reads «пт, 31 окт» (another year adds it: «вс, 1 мая 2016»), a time «09:05», the care entry's time «пт, 31 окт, 14:30».
- [ ] An empty field reads «Не выбрана» (a date) or «Не выбрано» (a time) in the muted colour.
- [ ] A tap anywhere on the field, not only at its edge, opens the native picker once; in Telegram Desktop and Web a click opens it too.
- [ ] Optional fields (Task date, time, end, «Повторять до», Subtask «Срок», Goal «Дедлайн», birth date, «Повторить») show «×» once a value is picked; «×» empties the field without opening the picker, and the screen reader reads it as «Очистить «<label>»». Required fields show no «×».
- [ ] The screen reader reads each field by its label; an invalid field gets the red border; an archived Pet's care entry shows its fields dimmed and untappable.

### Launch from the device cache

Each item on iOS and Android; Telegram Desktop and Web keep no cache between launches.

- [ ] The first launch shows Telegram's placeholder, then a skeleton of the screen while signing in, never «Входим…».
- [ ] A second launch shows the tab bar and Today with content straight after Telegram's placeholder, with no «Входим…» and no skeleton; fresh data replaces it without the layout jumping.
- [ ] A launch the next day shows «Сделать сегодня» as a skeleton until the new Today arrives, while «Впереди» and the tiles show at once.
- [ ] Opening an Invite link into another Family goes straight to the invitation, without the old Family's shell.
- [ ] After leaving the Family (or being removed), the next launch shows the stranger screen without the old Family's data.
- [ ] A launch from a cache older than the photo links' lifetime (or with a photo link edited to fail in DevTools) shows a same-size placeholder in place of every photo — thumbs, Album covers, the Pet avatar, the viewer — never a broken icon or a shifted row; fresh data brings the photos back.
- [ ] With the network throttled to Slow 3G and the cache cleared, Today, Задачи, Лента, Питомцы, Цели, Рецепты, Альбомы, «Все фото», a Pet's «Траты» and an Invite link each show a skeleton shaped like their screen, never «Загружаем…» or another text; the content replaces it without the layout jumping, in the light and the dark theme.
- [ ] The skeleton shimmers in the theme's colours; with reduced motion turned on in the system it stays a still block.
- [ ] With the network off on a first launch of a section, the screen shows its failure with «Повторить», and «Повторить» brings the content once the network is back.

Items for features that are not built yet are skipped until they land.

## After a production deploy

The deploy workflow checks `/api/health` itself. If a bot or cron change shipped, open the production bot once: the menu button opens the Mini App and `/start` answers.
