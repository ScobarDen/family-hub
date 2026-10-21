import { z } from "zod";

// The Mini App sends an emptied field as "", which means the field is cleared.
export function optionalText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .nullable()
    .transform((text) => (text === "" ? null : text));
}
