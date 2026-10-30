export type PushTarget = { endpoint: string; p256dh: string; auth: string };

// "gone" means the push service forgot the subscription (404 or 410), so it is not worth keeping.
export type PushOutcome = "accepted" | "gone" | "refused";

// The Reminder whose «Готово» and «Отложить» a Push carries, each Device with a token of its own.
export type PressTarget = { dispatchId: string; occurrence: string | null };

export type PushTransport = { send(target: PushTarget, payload: string): Promise<PushOutcome> };
