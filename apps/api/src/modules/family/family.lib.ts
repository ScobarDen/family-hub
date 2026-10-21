export function removedText(familyName: string): string {
  return `Вас исключили из семьи «${familyName}».`;
}

export function newOwnerText({
  familyName,
  formerOwnerName,
}: {
  familyName: string;
  formerOwnerName: string;
}): string {
  return `${formerOwnerName} передаёт вам роль владельца семьи «${familyName}». Теперь приглашать, исключать и удалять семью можете вы.`;
}

// Typing the name is the deliberate act, so surrounding spaces from the keyboard do not count.
export function isSameFamilyName(typed: string, familyName: string): boolean {
  return typed.trim() === familyName.trim();
}
