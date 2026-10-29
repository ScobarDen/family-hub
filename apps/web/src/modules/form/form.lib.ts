import { z } from "zod";

// Deleting forever asks to type the name back; spaces around it do not count.
export function matchingName(expected: () => string | undefined, mismatch: string) {
  return z
    .string()
    .refine((typed) => typed.trim() !== "" && typed.trim() === expected()?.trim(), mismatch);
}
