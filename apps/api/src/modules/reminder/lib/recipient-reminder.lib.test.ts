import { describe, expect, test } from "vite-plus/test";

import type { RemindingTask } from "@/modules/task";

import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { birthdaySource } from "./birthday-kind.lib.ts";
import { digestSource, type DigestFeed } from "./digest-kind.lib.ts";
import { recipientReminder } from "./recipient-reminder.lib.ts";
import { taskSource } from "./task-kind.lib.ts";

const vladivostok = "Asia/Vladivostok";
const chatLink = "https://t.me/family_hub_bot/app";
const openUrl = "https://t.me/family_hub_bot/app?startapp=task_task-1";

function rowOf(row: Partial<DispatchRow> = {}): DispatchRow {
  return {
    id: "dispatch-1",
    familyId: "family",
    source: "task",
    sourceId: "task-1:1h",
    memberId: "member-asya",
    occurrence: null,
    nextFireAt: null,
    sentOccurrence: null,
    chatId: null,
    messageId: null,
    doneAt: null,
    doneBy: null,
    lockedUntil: null,
    createdAt: 0,
    updatedAt: 0,
    ...row,
  };
}

function seriesOf(dates: string[]) {
  return {
    first: (day: string) => dates.find((date) => date >= day),
    next: (occurrence: string) => dates.find((date) => date > occurrence),
  };
}

function vetVisit(task: Partial<RemindingTask["task"]> = {}, dates = ["2026-11-12"]) {
  return {
    task: {
      id: "task-1",
      title: "Бьюик к ветеринару",
      when: {
        date: "2026-11-12",
        time: "18:00",
        timeZone: "Europe/Moscow",
        endDate: null,
        endTime: null,
      },
      petId: null,
      reminderOffsets: ["1h" as const],
      pet: undefined,
      ...task,
    },
    series: seriesOf(dates),
    recipientIds: ["member-asya"],
  };
}

const weeklyWalk = vetVisit(
  {
    title: "Погулять с Бьюиком",
    when: { date: "2026-11-10", time: null, timeZone: null, endDate: null, endTime: null },
    reminderOffsets: ["at-start"],
  },
  ["2026-11-10", "2026-11-17"],
);

describe("a due Task Reminder", () => {
  test("says what and when on the Recipient's clock, in the bot and in a Push", async () => {
    const source = taskSource(vetVisit(), { offset: "1h", chatLink, openUrl });
    const reminder = recipientReminder({
      row: rowOf({ occurrence: "2026-11-12", nextFireAt: Date.parse("2026-11-12T14:00:00Z") }),
      source,
      occurrence: "2026-11-12",
      timeZone: vladivostok,
      now: Date.parse("2026-11-12T14:00:00Z"),
    });

    expect(await reminder.due()).toEqual({
      status: "send",
      bot: {
        text: "📌 Бьюик к ветеринару · 13 ноября, 01:00",
        buttons: {
          inline_keyboard: [
            [
              { text: "✅ Готово", callback_data: "rd:done:dispatch-1", style: "success" },
              { text: "⏰ Отложить", callback_data: "rd:snooze:dispatch-1" },
            ],
            [{ text: "Открыть", url: openUrl }],
          ],
        },
      },
      push: {
        message: {
          title: "Бьюик к ветеринару",
          body: "Сегодня, 01:00 · Дела",
          text: "Бьюик к ветеринару",
          tag: "dispatch-1",
          startParam: "task_task-1",
        },
        press: { dispatchId: "dispatch-1", occurrence: "2026-11-12" },
      },
    });
  });

  test("more than 12 hours late sends nothing", async () => {
    const reminder = recipientReminder({
      row: rowOf({ occurrence: "2026-11-12", nextFireAt: Date.parse("2026-11-12T14:00:00Z") }),
      source: taskSource(vetVisit(), { offset: "1h", chatLink, openUrl }),
      occurrence: "2026-11-12",
      timeZone: vladivostok,
      now: Date.parse("2026-11-13T02:00:01Z"),
    });

    expect(await reminder.due()).toEqual({ status: "late" });
  });
});

describe("a press on a Task Reminder", () => {
  const firedAt = Date.parse("2026-11-12T14:00:00Z");

  function pressedReminder(row: Partial<DispatchRow> = {}, occurrence = "2026-11-12") {
    return recipientReminder({
      row: rowOf({
        occurrence: null,
        sentOccurrence: "2026-11-12",
        chatId: 77,
        messageId: 5,
        ...row,
      }),
      source: taskSource(vetVisit(), { offset: "1h", chatLink, openUrl }),
      occurrence,
      timeZone: vladivostok,
      now: firedAt,
    });
  }

  test("«Готово» completes the Occurrence in the task module", () => {
    expect(pressedReminder().press("done", "bot")).toEqual({
      status: "complete-task",
      taskId: "task-1",
      occurrence: "2026-11-12",
    });
  });

  test("an Occurrence the series no longer has open was done already", () => {
    expect(pressedReminder({}, "2026-11-05").press("done", "bot")).toEqual({
      status: "refused",
      text: "Уже сделано",
    });
  });

  test("«Отложить» brings the row back in an hour and says so on the Recipient's clock", () => {
    expect(pressedReminder().press("snooze", "bot")).toEqual({
      status: "snoozed",
      patch: {
        occurrence: "2026-11-12",
        nextFireAt: firedAt + 3_600_000,
        updatedAt: firedAt,
      },
      edit: {
        chatId: 77,
        messageId: 5,
        text: "⏰ Отложено до 01:00: Бьюик к ветеринару · 13 ноября, 01:00",
      },
    });
  });

  test("«Отложить» on a Push alone has no bot message to rewrite", () => {
    expect(
      pressedReminder({ chatId: null, messageId: null }).press("snooze", "push"),
    ).not.toHaveProperty("edit");
  });

  test("«Отложить» on a Push left behind by a later Occurrence is refused", () => {
    expect(pressedReminder({ sentOccurrence: "2026-11-19" }).press("snooze", "push")).toEqual({
      status: "refused",
      text: "Это напоминание уже прошло",
    });
  });

  test("a Task without a time snoozes for a day", () => {
    const reminder = recipientReminder({
      row: rowOf({ sentOccurrence: "2026-11-10" }),
      source: taskSource(weeklyWalk, { offset: "at-start", chatLink, openUrl }),
      occurrence: "2026-11-10",
      timeZone: vladivostok,
      now: firedAt,
    });

    expect(reminder.press("snooze", "bot")).toMatchObject({
      patch: { nextFireAt: firedAt + 86_400_000 },
    });
  });
});

describe("a press on a birthday Reminder", () => {
  const morning = Date.parse("2026-11-12T00:00:00Z");

  function birthdayReminder(row: Partial<DispatchRow> = {}) {
    return recipientReminder({
      row: rowOf({
        source: "pet_birthday",
        sourceId: "pet-1",
        sentOccurrence: "2026-11-12",
        ...row,
      }),
      source: birthdaySource({
        pet: { id: "pet-1", name: "Бьюик", birthDate: "2020-11-12" },
        recipientIds: ["member-asya", "member-denis"],
      }),
      occurrence: "2026-11-12",
      timeZone: vladivostok,
      now: morning,
    });
  }

  test("«Готово» closes the birthday for every Member", () => {
    expect(birthdayReminder().press("done", "bot")).toEqual({ status: "close-for-everyone" });
  });

  test("a birthday someone marked done refuses another press", () => {
    expect(
      birthdayReminder({ doneAt: morning, doneBy: "member-denis" }).press("snooze", "bot"),
    ).toEqual({ status: "refused", text: "Уже сделано" });
  });
});

function deliveredReminder() {
  return recipientReminder({
    row: rowOf({ occurrence: "2026-11-10", nextFireAt: Date.parse("2026-11-09T23:00:00Z") }),
    source: taskSource(weeklyWalk, { offset: "at-start", chatLink, openUrl }),
    occurrence: "2026-11-10",
    timeZone: vladivostok,
    now: Date.parse("2026-11-09T23:00:30Z"),
  });
}

describe("a recurring Task's row after a delivery", () => {
  test("moves on to the next Occurrence at 09:00 on the Recipient's clock, keeping the message", () => {
    expect(
      deliveredReminder().advanced({ status: "sent", sent: { chatId: 77, messageId: 5 } }),
    ).toEqual({
      occurrence: "2026-11-17",
      nextFireAt: Date.parse("2026-11-16T23:00:00Z"),
      lockedUntil: null,
      updatedAt: Date.parse("2026-11-09T23:00:30Z"),
      sentOccurrence: "2026-11-10",
      chatId: 77,
      messageId: 5,
      doneAt: null,
      doneBy: null,
    });
  });

  test("pushed only, it remembers the Occurrence with no bot message to edit", () => {
    expect(deliveredReminder().advanced({ status: "pushed" })).toMatchObject({
      occurrence: "2026-11-17",
      sentOccurrence: "2026-11-10",
      chatId: null,
      messageId: null,
    });
  });

  test("not delivered, it moves on and leaves the last sent message answerable", () => {
    expect(deliveredReminder().advanced({ status: "skipped" })).toEqual({
      occurrence: "2026-11-17",
      nextFireAt: Date.parse("2026-11-16T23:00:00Z"),
      lockedUntil: null,
      updatedAt: Date.parse("2026-11-09T23:00:30Z"),
    });
  });

  test("past the last Occurrence, it rests with nothing to fire", () => {
    const last = recipientReminder({
      row: rowOf({ occurrence: "2026-11-17" }),
      source: taskSource(weeklyWalk, { offset: "at-start", chatLink, openUrl }),
      occurrence: "2026-11-17",
      timeZone: vladivostok,
      now: Date.parse("2026-11-16T23:00:30Z"),
    });

    expect(last.advanced({ status: "skipped" })).toMatchObject({
      occurrence: null,
      nextFireAt: null,
    });
  });
});

describe("a Task Occurrence closed by someone", () => {
  const closedAt = Date.parse("2026-11-10T08:00:00Z");
  const denis = { id: "member-denis", name: "Денис" };

  function closedReminder(row: Partial<DispatchRow>) {
    return recipientReminder({
      row: rowOf(row),
      source: taskSource(weeklyWalk, { offset: "at-start", chatLink, openUrl }),
      occurrence: "2026-11-10",
      timeZone: vladivostok,
      now: closedAt,
    });
  }

  test("rewrites the message it was sent into who did it and marks the row", () => {
    expect(
      closedReminder({
        occurrence: "2026-11-17",
        sentOccurrence: "2026-11-10",
        chatId: 77,
        messageId: 5,
      }).closed(denis),
    ).toEqual({
      patch: { doneAt: closedAt, doneBy: "member-denis", updatedAt: closedAt },
      edit: {
        chatId: 77,
        messageId: 5,
        text: "✅ Сделал(а) Денис: Погулять с Бьюиком · 10 ноября",
      },
    });
  });

  test("a row still waiting for it moves on to the next Occurrence", () => {
    expect(closedReminder({ occurrence: "2026-11-10" }).closed(denis)).toEqual({
      patch: {
        occurrence: "2026-11-17",
        nextFireAt: Date.parse("2026-11-16T23:00:00Z"),
        updatedAt: closedAt,
      },
    });
  });

  test("a message already marked done stays as it is", () => {
    expect(
      closedReminder({
        occurrence: "2026-11-17",
        sentOccurrence: "2026-11-10",
        doneAt: closedAt - 1,
        doneBy: "member-asya",
      }).closed(denis),
    ).toBeUndefined();
  });
});

describe("a due Digest", () => {
  const digestTime = Date.parse("2026-11-11T22:00:00Z");

  function digestReminder(content: DigestFeed) {
    const source = digestSource({
      memberId: "member-asya",
      digestTime: "08:00",
      appUrl: "https://t.me/family_hub_bot/app",
      contentOf: async () => content,
    });

    return {
      reminder: recipientReminder({
        row: rowOf({
          source: "digest",
          sourceId: "member-asya",
          occurrence: "2026-11-12",
          nextFireAt: digestTime,
        }),
        source,
        occurrence: "2026-11-12",
        timeZone: vladivostok,
        now: digestTime,
      }),
    };
  }

  test("on a day with nothing to say sends nothing", async () => {
    const { reminder } = digestReminder({ overdue: [], today: [] });

    expect(await reminder.due()).toEqual({ status: "silent" });
  });

  test("lists the day under its heading, in a Push with no buttons to press", async () => {
    const { reminder } = digestReminder({
      overdue: [],
      today: [
        {
          kind: "task",
          key: "task-1:2026-11-12",
          title: "Погулять с Бьюиком",
          date: "2026-11-12",
          time: null,
          taskId: "task-1",
          occurrence: "2026-11-12",
          subtaskId: null,
          petId: null,
          petPicture: null,
          assignees: [],
        },
      ],
    });

    expect(await reminder.due()).toEqual({
      status: "send",
      bot: {
        text: "☀️ Сводка на 12 ноября\n\n📅 Сегодня\n• Погулять с Бьюиком",
        buttons: {
          inline_keyboard: [[{ text: "Открыть ленту", url: "https://t.me/family_hub_bot/app" }]],
        },
      },
      push: {
        message: {
          title: "Сводка на 12 ноября",
          body: "📅 Сегодня\n• Погулять с Бьюиком",
          text: "Сводка на 12 ноября",
          tag: "dispatch-1",
        },
      },
    });
  });
});
