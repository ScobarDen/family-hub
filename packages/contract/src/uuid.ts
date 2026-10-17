const hexRadix = 16;
const timestampDigits = 12;
const firstGroupDigits = 8;
const randomTailStart = 15;
const version = "7";

export function uuidv7(now: number): string {
  const timestamp = now.toString(hexRadix).padStart(timestampDigits, "0");
  const random = crypto.randomUUID();

  return `${timestamp.slice(0, firstGroupDigits)}-${timestamp.slice(firstGroupDigits)}-${version}${random.slice(randomTailStart)}`;
}
