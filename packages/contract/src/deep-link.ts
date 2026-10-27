import { z } from "zod";

const deepLinkMaxLength = 64;

// `plan` and `event` stay so old bot messages open the Task each became.
const deepLinkKind = z.enum(["inv", "pet", "entry", "task", "rec", "event", "goal", "plan", "cmd"]);

type DeepLinkKind = z.infer<typeof deepLinkKind>;

export type DeepLink = { kind: DeepLinkKind; id: string };

const payload = z
  .string()
  .max(deepLinkMaxLength)
  .regex(/^[A-Za-z0-9_-]+$/);
const id = z.string().regex(/^[A-Za-z0-9_-]+$/);

export function encodeDeepLink(link: DeepLink): string {
  return payload.parse(`${deepLinkKind.parse(link.kind)}_${id.parse(link.id)}`);
}

export function parseDeepLink(raw: string | undefined): DeepLink | undefined {
  if (raw === undefined || !payload.safeParse(raw).success) {
    return undefined;
  }

  const separator = raw.indexOf("_");
  const kind = deepLinkKind.safeParse(raw.slice(0, separator));
  const value = raw.slice(separator + 1);

  return separator > 0 && kind.success && value !== "" ? { kind: kind.data, id: value } : undefined;
}
