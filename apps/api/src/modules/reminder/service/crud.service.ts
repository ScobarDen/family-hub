import { uuidv7, type Reminder, type ReminderChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import { toReminder } from "../reminder.lib.ts";
import type { ReminderDependencies, ReminderRefusal, ReminderResult } from "../reminder.types.ts";
import type { ReminderWithRecipients } from "../repo/reminder.repo.ts";
import { reschedule } from "./schedule.service.ts";

type Recipients = { isForEveryone: boolean; ids: string[] };

// A Private Reminder only ever reaches its owner; a Shared one reaches everyone unless narrowed.
async function recipientsOf(
  { reminders }: ReminderDependencies,
  { family }: Membership,
  { change, ownerId }: { change: ReminderChange; ownerId: string },
): Promise<Recipients | ReminderRefusal> {
  const ids = change.recipientIds;

  if (change.visibility === "private") {
    return ids === null || (ids.length === 1 && ids[0] === ownerId)
      ? { isForEveryone: false, ids: [ownerId] }
      : "recipients-not-allowed";
  }

  if (ids === null) {
    return { isForEveryone: true, ids: [] };
  }

  return (await reminders.areMembers(family.id, ids))
    ? { isForEveryone: false, ids: [...new Set(ids)] }
    : "recipients-not-allowed";
}

async function visible(
  { reminders }: ReminderDependencies,
  { family, member }: Membership,
  reminderId: string,
): Promise<ReminderWithRecipients | undefined> {
  const found = await reminders.find({ familyId: family.id, reminderId });
  const isHidden =
    found?.reminder.visibility === "private" && found.reminder.ownerMemberId !== member.id;

  return isHidden ? undefined : found;
}

type Saving = { reminderId: string; ownerId: string; isNew: boolean; change: ReminderChange };

async function save(
  dependencies: ReminderDependencies,
  membership: Membership,
  { reminderId, ownerId, isNew, change }: Saving,
): Promise<ReminderResult> {
  const recipients = await recipientsOf(dependencies, membership, { change, ownerId });

  if (typeof recipients === "string") {
    return { status: recipients };
  }

  const now = dependencies.clock.now();

  await dependencies.reminders.save(
    {
      row: {
        id: reminderId,
        familyId: membership.family.id,
        ownerMemberId: ownerId,
        visibility: change.visibility,
        text: change.text,
        startDate: change.start.date,
        startTime: change.start.time,
        timeZone: change.start.timeZone,
        frequency: change.recurrence?.frequency ?? null,
        until: change.recurrence?.until ?? null,
        isForEveryone: recipients.isForEveryone,
        createdAt: now,
        createdBy: membership.member.id,
        updatedAt: now,
      },
      isNew,
    },
    recipients.ids,
  );

  const saved = await visible(dependencies, membership, reminderId);

  if (!saved) {
    return { status: "not-found" };
  }

  await reschedule(dependencies, saved);

  return { status: "ok", reminder: toReminder(saved, membership.member.id) };
}

export async function list(
  { reminders }: ReminderDependencies,
  { family, member }: Membership,
): Promise<Reminder[]> {
  const found = await reminders.listVisible(family.id, member.id);

  return found.map((entry) => toReminder(entry, member.id));
}

export async function create(
  dependencies: ReminderDependencies,
  membership: Membership,
  change: ReminderChange,
): Promise<ReminderResult> {
  return save(dependencies, membership, {
    reminderId: uuidv7(dependencies.clock.now()),
    ownerId: membership.member.id,
    isNew: true,
    change,
  });
}

export async function update(
  dependencies: ReminderDependencies,
  membership: Membership,
  { reminderId, change }: { reminderId: string; change: ReminderChange },
): Promise<ReminderResult> {
  const found = await visible(dependencies, membership, reminderId);

  if (!found) {
    return { status: "not-found" };
  }

  if (found.reminder.visibility === "shared" && change.visibility === "private") {
    return { status: "visibility-one-way" };
  }

  return save(dependencies, membership, {
    reminderId,
    ownerId: found.reminder.ownerMemberId ?? membership.member.id,
    isNew: false,
    change,
  });
}

export type DeleteResult = { status: "deleted" } | { status: ReminderRefusal };

export async function remove(
  dependencies: ReminderDependencies,
  membership: Membership,
  reminderId: string,
): Promise<DeleteResult> {
  const found = await visible(dependencies, membership, reminderId);

  if (!found) {
    return { status: "not-found" };
  }

  if (found.reminder.ownerMemberId !== membership.member.id) {
    return { status: "not-owner" };
  }

  await dependencies.reminders.delete({ familyId: membership.family.id, reminderId });
  await dependencies.dispatch.remove({
    familyId: membership.family.id,
    source: "reminder",
    prefix: reminderId,
  });

  return { status: "deleted" };
}
