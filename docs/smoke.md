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
- [ ] Completing a Task in the Mini App turns its sent Reminders into «Сделал(а) …» with that Member's name, and their buttons are gone.
- [ ] On a Task with two Reminder offsets, «✅ Готово» on one message also edits the other offset's message.
- [ ] «⏰ Отложить» postpones only the pressing Recipient's copy; a new message arrives after the delay (move the clock with a manual tick).
- [ ] A button pressed by someone who is not that message's Recipient changes nothing and shows an alert.
- [ ] «⏰ Отложить» comes back in an hour for a timed Task and in a day for a Task without a time.
- [ ] A Pet-linked Task's Reminder also has «📝 Записать»: it opens the Mini App, completes that Occurrence and opens a Care Entry for the Pet.
- [ ] «Открыть» opens the Mini App on that Task, from a private chat and from a group the Reminder was forwarded to.

### Quick add

Each item on iOS, Android and Telegram Desktop.

- [ ] The «+» in the centre of the tab bar gives a light haptic tick and opens a sheet with no heading, only the tiles Дело, Запись питомцу, Взнос and Фото.
- [ ] «Дело» closes the sheet and opens the new Task form in «Дела»; «Запись питомцу» asks for a Pet when there are several, then opens the Care Entry form; «Взнос» opens the Contribution form of the nearest Savings Goal; «Фото» opens the system photo picker and uploads to the Family's photos.
- [ ] Without a Savings Goal there is no «Взнос»; without Photo Storage there is no «Фото».
- [ ] A text or a voice message to the bot answers «Я больше не разбираю сообщения…» with «Открыть», which opens the Mini App; `/today` still answers with the digest.

### Buttons

- [ ] With the network throttled, «Сохранить» in a Task form, «Отправить заявку», «Вступить» and «Удалить навсегда» keep their size, show a spinner over an invisible label, and cannot be pressed again until the answer; the screen reader reads them as busy.
- [ ] «Пригласить в семью» keeps its title and shows a spinner at the row's end while the Invite is made.

### Tab bar

On iOS and Android at 320px wide, in the light and the dark theme.

- [ ] Every tab shows its title under the icon; «Сегодня» and «Разделы» fit whole beside the «+», and the screen reader reads each tab by that title, the open one as current.
- [ ] With the screen in greyscale (Accessibility → Colour filters), the open tab still stands out by the pill behind its icon and its bolder title.

### Narrow screens

On iOS and Android at 320px wide, with a Pet, an Album and a Recipe tag each named with 40 characters (one of them a single word with no spaces).

- [ ] The Task form (with a Pet and an Album to choose), the Recipes filters, the Recipe tag picker and the Contribution form never scroll sideways; a long chip wraps onto two or more lines inside the screen and is no lower than the short chips beside it.
- [ ] «Кому напомнить» offers «Исполнителям», «Всем», «Выбрать» with the hint «Если исполнителей нет, напомню вам» under them, read by the screen reader with the group.
- [ ] On Tasks, «Список · Календарь» and «Все · Мои» stay whole on screen; «Все · Мои» moves to a second row on the right when they do not fit on one.
- [ ] A Pet's card with month spending of «12 345 ₽» shows the figures in two columns, never splitting a number across lines; at 375px wide they are three columns again.

### Wide window

In Telegram Desktop and in the Installed App in Chrome, resizing the window to 1440px, 1024px, 1023px, 390px and 320px wide, in the light and the dark theme.

- [ ] At 1440px Today shows two columns: «Сделать сегодня» and «Впереди» on the left, the module tiles three to a row on the right; with nothing due today the tiles still keep the right column. The loading skeleton takes the same two columns.
- [ ] At 1024px Today is one column with the tiles two to a row; at 1023px and below it is one column with three tiles to a row, as before.
- [ ] From 1024px every module screen and the Profile sit in a centred column beside the sidebar, wider than the tab bar and never stretched across the window; below it the column is as wide as the tab bar.
- [ ] A rolled-back change (switch the network off, then complete a Task) shows the failure bar at the bottom centre of the content, clear of the sidebar and with no gap left for a tab bar; the last row of the screen scrolls clear of it. The undo bar of a completed Task sits in the same place. Opened over the photo viewer, the bar centres on the whole window.
- [ ] At 1023px, 390px and 320px the failure bar and the undo bar sit above the tab bar as before, and nothing scrolls sideways.
- [ ] From 1024px the sidebar replaces the tab bar: «+ Добавить» at the top, then «Сегодня», the Member's two tab-bar modules in their slot order, the other modules in the «Разделы» order, and «Профиль» at the bottom; there is no «Разделы» item and no slot setup. Changing the slots in a narrow window and widening again reorders the items the same way.
- [ ] Exactly one item is highlighted: the one whose screen is open, a Pet's card under «Питомцы» and a record opened from Today or the Feed under its own module. A click on the highlighted item from a record inside it returns to that module's list.
- [ ] «Профиль» opens as a root: no Back in Telegram, no back gesture in the Installed App; Telegram's settings button opens the same screen with «Профиль» highlighted.
- [ ] Open «Разделы», then «Настроить таб-бар», at 390px and widen past 1024px: Today shows with «Сегодня» highlighted. Reloading `/family-hub/sections` and `/family-hub/sections/tab-bar` at 1440px also opens Today. At 390px both screens stay as before.
- [ ] From 1024px «+ Добавить», a create or edit form and a deletion confirmation open as a centred dialog over a dimmed page instead of a bottom sheet. Escape, a click on the overlay and «Отмена» close it; with unsaved input each of them asks «Отменить изменения?» first. Tab stays inside the dialog, and on close focus returns to the button that opened it. The screen reader names the dialog by its title.
- [ ] In the photo viewer at 1440px ArrowLeft and ArrowRight step through the photos and stop at the first and the last; the step buttons show on hover and on keyboard focus, and none shows at an end. Escape closes the viewer. On a touch screen a swipe still steps, and the buttons stay shown.
- [ ] A click on a sidebar item fades the screen (about 150 ms) instead of sliding it; a record opened inside the item and Back still slide. A record opened from Today fades into its module. With reduced motion on, neither the fade nor the slide plays.
- [ ] With a Task's card open, then a Savings Goal's form with unsaved input, resize across 1024px both ways: the card and the form stay open with their input, a form switches between the bottom sheet and the dialog, the highlighted tab or item matches the screen, and Back closes the form before leaving the screen.

### Type scale

On iOS and Android at 320px and 375px wide, in the light and the dark theme.

- [ ] Every screen's title and the full-screen notices (the stranger screen, an Invite, a lost session) share one size.
- [ ] Goals' total, a Pet's month spending and its last weight show in one large figure size; the Goals total fits on one line above its description.
- [ ] A Pet's card, Today's tiles and a Savings Goal's «… из …» keep their figures as before, with nothing wrapping that did not wrap.
- [ ] Section headers, row subtitles, the Tasks calendar and agenda, the tab bar labels and the digest preview look as before.
- [ ] With the network throttled, the skeleton lines of a section's rows and of the Pets, Goals, Recipes and Albums heads sit at the height of the text that replaces them, without the layout jumping.

### Announcements

With VoiceOver on iOS and TalkBack on Android.

- [ ] Reaching a Savings Goal's target reads «Цель достигнута!» once.
- [ ] Uploading photos to an Album reads the count as it grows; the row shows an upload icon, not an empty circle.
- [ ] A Task's card shows one failure bar when a change is rolled back, and it is read once.
- [ ] A field error and a form's failure are read politely after the current speech, not cutting it off.
- [ ] Saving a Task, a Savings Goal or a care entry with an empty required field moves focus to that field, and the screen reader reads its label, «недопустимое значение» (or the platform's word) and the error text; the first of several invalid fields gets focus. A date field reads its error too. A form the server refused leaves focus on «Сохранить».
- [ ] Rows that repeat a button name its record: «Удалить взнос 5 000 ₽ от 12 ноября» and «Изменить …» on a movement, «Изменить шаг: …» / «Удалить шаг: …» on a Subtask, «Отозвать: Приглашение до 3 ноября», «Удалить тег «Супы»» and its field «Название тега «Супы»», «Удалить отметку «Приготовили» …» with its day, «Убрать фото 2» on a picked photo. Thumbs read «Открыть фото 2 из 3», and in a strip of three under «+4» they count all seven: the last reads «Открыть фото 3 из 7, ещё 4 фото»; a Task's Album thumbs read «Открыть альбом».
- [ ] A Recipe's ingredient reads as a toggle button, pressed once ticked and not pressed again after a second tap.
- [ ] In a Savings Goal's form the cover reads as two radio groups, «Значок» and «Цвет», each with its chosen option checked.
- [ ] In the Tasks calendar the screen reader reads a day as «вторник, 20 октября, есть дела» (a day without Tasks drops «есть дела»), today also as the current date and the picked day as pressed; it never reads the weekday header or the dot. Days of the next and previous month read as clearly as this month's.

### Overlays

With a keyboard in Telegram Desktop or the browser, then with VoiceOver and TalkBack.

- [ ] Opening a photo from a thumb puts focus on «Закрыть»; Tab cycles only through the viewer's bar and the step buttons, never onto the screen behind; ArrowLeft and ArrowRight step through the photos; Escape closes the viewer and focus lands back on that thumb. The screen reader announces a dialog «Фото».
- [ ] A refused photo deletion shows its failure bar over the open viewer, read once; «Скрыть» there dismisses it.
- [ ] The «+» opens a bottom drawer that a screen reader names «Добавить», with focus inside it; Tab stays inside it; Escape, a swipe down and a tap on the dimmed page close it and focus returns to the «+».

### Keyboard focus

With a keyboard in Telegram Desktop or the browser, in the light and the dark theme.

- [ ] Tab shows a solid ring with a small gap around every button (a filled «Сохранить» and a red «Удалить» too), input, text area, date and time field and switch; it stands out on the card and on the grey page.
- [ ] The time zone select in the Member's settings shows the ring when Tab reaches it.
- [ ] Tapping or clicking any of them shows no ring; text fields and date fields may show it, as the browser decides for anything that takes typing.
- [ ] Tabbing down to the last row of a long Feed or Recipes list scrolls it fully above the tab bar; with an undo or failure bar on screen, fully above that bar too.
- [ ] Opening a Task, a Pet, a Goal, an Album or a Recipe from its list puts focus on the new screen's heading, and the screen reader reads it; so does opening Recipe tags. A form (a Task's form, a Subtask, a care entry, a movement, an Album's form) slides up as a bottom drawer named by its title, with the screen it came from still under it; «Отмена», a swipe down, a tap on the dimmed page or Back closes it and returns focus to the control that opened it. Back from a screen puts focus on the heading of the screen returned to. The page does not jump to the heading.
- [ ] Switching tabs inside a screen (Pets, Goals, Recipes, Albums, «Мои» / «Все» in Tasks) or a Feed filter leaves focus on the tab or filter.

### Date and time fields

Each item on iOS and Android, in the light and the dark theme.

- [ ] Every date field in the Task, Subtask, Savings Goal, Contribution, Pet profile and care forms, «Когда приготовили» and «Время сводки» show a calendar or clock icon and no native arrow; a date reads «пт, 31 окт» (another year adds it: «вс, 1 мая 2016»), a time «09:05», the care entry's time «пт, 31 окт, 14:30».
- [ ] An empty field reads «Не выбрана» (a date) or «Не выбрано» (a time) in the muted colour.
- [ ] A tap anywhere on the field, not only at its edge, opens the native picker once; in Telegram Desktop and Web a click opens it too.
- [ ] Optional fields (Task date, time, end, «Повторять до», Subtask «Срок», Goal «Дедлайн», birth date, «Повторить») show «×» once a value is picked; «×» empties the field without opening the picker, and the screen reader reads it as «Очистить «<label>»». Required fields show no «×».
- [ ] The screen reader reads each field by its label; an invalid field gets the red border; an archived Pet's care entry shows its fields dimmed and untappable.

### Number keypads

On iOS and Android.

- [ ] The care entry's «Вес, кг» opens the decimal keypad with a separator key; «12,4» is saved as 12.4. «Цель, ₽», «Сумма, ₽» in a Contribution and the care entry's «Сумма, ₽» and «Стоимость, ₽» open the digit keypad.
- [ ] Pasting text works in every text field, amounts included.

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
- [ ] Opening a section from «Разделы» or a record from Today or the Feed slides the new screen in from the right; Telegram's Back slides it out to the right, inside a module (a Task's card) too, and closes an open form's drawer first. Opening a record inside a module's own list swaps at once.
- [ ] A tab-bar tap swaps the screen at once, with no slide.
- [ ] The quick-add sheet rises from the bottom; a swipe down lets it sink and fade, quicker than it came.
- [ ] Completing a Task in «Сделать сегодня» turns the circle into a check (it grows out of a blur), then the row folds away and the rows below close the gap; «Отменить» opens it up again. Completing the last one folds the whole card.
- [ ] The undo and failure bars rise from the bottom as they appear.
- [ ] On a first launch with the cache cleared, Today's blocks come in one after another, 100 ms apart; every other screen's content fades in over its skeleton. A second launch shows everything at once.
- [ ] A Savings Goal's bar fills from empty when it opens and grows smoothly after a Contribution; reaching Achieved shows «Цель достигнута!» once with a small zoom.
- [ ] With reduced motion on, nothing slides, scales or blurs: screens, the sheet, bars and blocks only fade, and completed rows fade before they close.
- [ ] With reduced motion on, a switch in «Настройки» jumps to its new side without sliding; with it off the thumb slides.
- [ ] On a client without View Transitions (Telegram Desktop on an old WebView, or Safari before 18) every screen swaps at once and nothing breaks.

### Photos and badges

In the light and the dark theme.

- [ ] Every content photo — Album covers, photo strips in the Feed, Albums, a Pet's care and a Recipe, the Pet avatar, round Pet pictures in rows and on Today, photos attached to a form — has the same faint 1px edge, black in light and white in dark, following its corners.
- [ ] The Pet card's corners run parallel to the avatar's inside it: the card's corner is visibly rounder by the 16px inset.
- [ ] The notifications banner's bell and every coloured icon badge (Savings Goal covers in the list, the form and the progress card, Settings rows) read clearly white on their colour.

Items for features that are not built yet are skipped until they land.

## After a production deploy

The deploy workflow checks `/api/health` itself. If a bot or cron change shipped, open the production bot once: the menu button opens the Mini App and `/start` answers.
