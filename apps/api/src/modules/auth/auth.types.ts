export type Membership = {
  member: {
    id: string;
    name: string;
    profilePicture: string | null;
    telegramId: number;
    canMessage: boolean;
    timeZone: string | null;
  };
  family: { id: string; name: string };
  isFamilyOwner: boolean;
};
