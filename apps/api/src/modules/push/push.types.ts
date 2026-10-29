export type PushTarget = { endpoint: string; p256dh: string; auth: string };

// Answers the push service's HTTP status; a 404 or 410 means the subscription is gone.
export type PushTransport = { send(target: PushTarget, payload: string): Promise<number> };
