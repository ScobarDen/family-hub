export type PushTarget = { endpoint: string; p256dh: string; auth: string };

// "gone" means the push service forgot the subscription (404 or 410), so it is not worth keeping.
export type PushOutcome = "accepted" | "gone" | "refused";

export type PushTransport = { send(target: PushTarget, payload: string): Promise<PushOutcome> };
