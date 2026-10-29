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

export const deviceSignIn = deviceSession.extend({
  device: z.object({ id: z.string(), credential: z.string() }),
});

export type DeviceSignIn = z.infer<typeof deviceSignIn>;

export const device = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.number().int(),
  lastUsedAt: z.number().int(),
});

export type Device = z.infer<typeof device>;

export const deviceList = z.array(device);

export type DeviceList = z.infer<typeof deviceList>;

// The shape of PushSubscription.toJSON() in the browser.
export const pushSubscription = z.object({
  endpoint: z.url({ protocol: /^https$/ }),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export type PushSubscriptionChange = z.infer<typeof pushSubscription>;

export const pushKey = z.object({ publicKey: z.string() });

export type PushKey = z.infer<typeof pushKey>;

// What the service worker receives; `startParam` opens a record as a `start_param` would.
export const pushMessage = z.object({ text: z.string(), startParam: z.string().optional() });

export type PushMessage = z.infer<typeof pushMessage>;
