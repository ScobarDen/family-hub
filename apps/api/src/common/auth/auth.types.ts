export type Membership = {
  member: { id: string; name: string; telegramId: number; canMessage: boolean };
  family: { id: string; name: string };
  isFamilyOwner: boolean;
};
