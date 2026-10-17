export type Membership = {
  member: { id: string; name: string; telegramId: number };
  family: { id: string; name: string };
  isFamilyOwner: boolean;
};
