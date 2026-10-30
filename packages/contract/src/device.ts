import { z } from "zod";

import { currentMember, sessionToken } from "./session.ts";

// What the Telegram Login widget hands the page; every field it sends is signed, so unknown ones
// are kept for the hash check.
export const telegramWidgetLogin = z.looseObject({
  id: z.number().int(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number().int(),
  hash: z.string(),
});

export type TelegramWidgetLogin = z.infer<typeof telegramWidgetLogin>;

export const deviceCredential = z.object({ credential: z.string().min(1) });

export type DeviceCredential = z.infer<typeof deviceCredential>;

export const deviceSession = currentMember.extend(sessionToken.shape);

export type DeviceSession = z.infer<typeof deviceSession>;

export const loginSession = deviceSession.extend({
  device: z.object({ id: z.string(), credential: z.string() }),
});

export type LoginSession = z.infer<typeof loginSession>;

export const device = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.number().int(),
  lastUsedAt: z.number().int(),
});

export type Device = z.infer<typeof device>;

export const deviceList = z.array(device);

export type DeviceList = z.infer<typeof deviceList>;

// The Worker posts to whatever endpoint it is given, so only the browsers' own push services pass.
const pushServiceHost =
  /^(?:fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[\w.-]+\.push\.apple\.com|[\w.-]+\.notify\.windows\.com)$/u;

// The shape of PushSubscription.toJSON() in the browser: a P-256 point and a 16-byte secret.
export const pushSubscription = z.object({
  endpoint: z.url({ protocol: /^https$/u, hostname: pushServiceHost }),
  keys: z.object({
    p256dh: z.string().regex(/^[\w-]{87}=?$/u),
    auth: z.string().regex(/^[\w-]{22}(?:==)?$/u),
  }),
});

export type PushSubscriptionChange = z.infer<typeof pushSubscription>;

export const pushKey = z.object({ publicKey: z.string() });

export type PushKey = z.infer<typeof pushKey>;

// What the Device holds for itself; `null` when the server keeps no subscription for it.
export const pushEndpoint = z.object({ endpoint: z.string().nullable() });

export type PushEndpoint = z.infer<typeof pushEndpoint>;

// The browser replaced a subscription; the old endpoint, known only to the Device and the Worker,
// stands in for a session the service worker does not have (ADR 0016).
export const pushRotation = z.object({
  oldEndpoint: z.string().min(1),
  subscription: pushSubscription,
});

export type PushRotation = z.infer<typeof pushRotation>;

// What the service worker receives. `tag` replaces the Push of the same Reminder, `startParam`
// opens a record as a `start_param` would, and `pressToken` answers «Готово» or «Отложить».
export const pushMessage = z.object({
  title: z.string(),
  body: z.string(),
  tag: z.string(),
  startParam: z.string().optional(),
  pressToken: z.string().optional(),
});

export type PushMessage = z.infer<typeof pushMessage>;

export const pushPress = z.object({
  token: z.string().min(1),
  action: z.enum(["done", "snooze"]),
});

export type PushPress = z.infer<typeof pushPress>;
