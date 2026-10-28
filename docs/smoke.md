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

### Tab bar

On iOS and Android at 320px wide, in the light and the dark theme.

- [ ] Every tab shows its title under the icon; «Сегодня» and «Разделы» fit whole beside the microphone, and the screen reader reads each tab by that title, the open one as current.
- [ ] With the screen in greyscale (Accessibility → Colour filters), the open tab still stands out by the pill behind its icon and its bolder title.

### Narrow screens

On iOS and Android at 320px wide, with a Pet, an Album and a Recipe tag each named with 40 characters (one of them a single word with no spaces).

- [ ] The Task form (with a Pet and an Album to choose), the Recipes filters, the Recipe tag picker and the Contribution form never scroll sideways; a long chip wraps onto two or more lines inside the screen and is no lower than the short chips beside it.
- [ ] «Кому напомнить» offers «Исполнителям», «Всем», «Выбрать» with the hint «Если исполнителей нет, напомню вам» under them, read by the screen reader with the group.
- [ ] On Tasks, «Список · Календарь» and «Все · Мои» stay whole on screen; «Все · Мои» moves to a second row on the right when they do not fit on one.
- [ ] A Pet's card with month spending of «12 345 ₽» shows the figures in two columns, never splitting a number across lines; at 375px wide they are three columns again.

### Announcements

With VoiceOver on iOS and TalkBack on Android.

- [ ] Holding the microphone announces the recording; a refused or first hold announces its hint.
- [ ] After release the screen reader reads the recognised draft, then «Создано» after «Создать», or the Command's failure, each once.
- [ ] Reaching a Savings Goal's target reads «Цель достигнута!» once.
- [ ] Uploading photos to an Album reads the count as it grows; the row shows an upload icon, not an empty circle.
- [ ] A Task's card shows one failure bar when a change is rolled back, and it is read once.
- [ ] A field error and a form's failure are read politely after the current speech, not cutting it off.
- [ ] In the Tasks calendar the screen reader reads a day as «вторник, 20 октября, есть дела» (a day without Tasks drops «есть дела»), today also as the current date and the picked day as pressed; it never reads the weekday header or the dot. Days of the next and previous month read as clearly as this month's.

### Overlays

With a keyboard in Telegram Desktop or the browser, then with VoiceOver and TalkBack.

- [ ] Opening a photo from a thumb puts focus on «Закрыть»; Tab cycles only through the viewer's bar and the step buttons, never onto the screen behind; ArrowLeft and ArrowRight step through the photos; Escape closes the viewer and focus lands back on that thumb. The screen reader announces a dialog «Фото».
- [ ] A refused photo deletion shows its failure bar over the open viewer, read once; «Скрыть» there dismisses it.
- [ ] The Command Sheet opens as a dialog «Команда» with focus on «Закрыть»; Tab stays inside it; Escape closes it like «×» (a pending draft is dropped) and focus returns to the microphone.

### Keyboard focus

With a keyboard in Telegram Desktop or the browser, in the light and the dark theme.

- [ ] Tab shows a solid ring with a small gap around every button (a filled «Сохранить» and a red «Удалить» too), input, text area, date and time field and switch; it stands out on the card and on the grey page.
- [ ] The time zone select in the Member's settings shows the ring when Tab reaches it.
- [ ] Tapping or clicking any of them shows no ring; text fields and date fields may show it, as the browser decides for anything that takes typing.
- [ ] Tabbing down to the last row of a long Feed or Recipes list scrolls it fully above the tab bar; with an undo or failure bar on screen, fully above that bar too.

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

### Motion

Each item on iOS and Android, once with the system's reduced motion off and once with it on.

- [ ] Buttons, rows, Today's tiles, chips and the completion circle shrink a little while pressed and spring back; a disabled or spinning button does not move.
- [ ] Opening a section from «Разделы» or a record from Today or the Feed slides the new screen in from the right; Telegram's Back slides it out to the right, inside a module (a form, a Task's card) too. Opening a record inside a module's own list swaps at once.
- [ ] A tab-bar tap swaps the screen at once, with no slide.
- [ ] The command sheet rises from the bottom; «×» lets it sink a little and fade, quicker than it came.
- [ ] Completing a Task in «Сделать сегодня» turns the circle into a check (it grows out of a blur), then the row folds away and the rows below close the gap; «Отменить» opens it up again. Completing the last one folds the whole card.
- [ ] The undo and failure bars rise from the bottom as they appear.
- [ ] On a first launch with the cache cleared, Today's blocks come in one after another, 100 ms apart; every other screen's content fades in over its skeleton. A second launch shows everything at once.
- [ ] A Savings Goal's bar fills from empty when it opens and grows smoothly after a Contribution; reaching Achieved shows «Цель достигнута!» once with a small zoom.
- [ ] With reduced motion on, nothing slides, scales or blurs: screens, the sheet, bars and blocks only fade, and completed rows fade before they close.
- [ ] On a client without View Transitions (Telegram Desktop on an old WebView, or Safari before 18) every screen swaps at once and nothing breaks.

Items for features that are not built yet are skipped until they land.

## After a production deploy

The deploy workflow checks `/api/health` itself. If a bot or cron change shipped, open the production bot once: the menu button opens the Mini App and `/start` answers.
