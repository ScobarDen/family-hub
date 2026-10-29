import type { ReminderChannel } from "@family-hub/contract";

export type Membership = {
  member: {
    id: string;
    name: string;
    profilePicture: string | null;
    telegramId: number;
    canMessage: boolean;
    timeZone: string | null;
    reminderChannel: ReminderChannel;
  };
  family: { id: string; name: string };
  isFamilyOwner: boolean;
};
