import { atom, noop, wrap } from "@reatom/core";
import { z } from "zod";

import {
  currentMember,
  deleted,
  deviceSession,
  deviceSignIn,
  sessionResponse,
  type TelegramWidgetLogin,
} from "@family-hub/contract";

import { refusalOf, type HttpClient } from "@/common/http-client.api.ts";

const deviceKey = "family-hub:device";

const storedDevice = z.object({ id: z.string(), credential: z.string() });

export type StoredDevice = z.infer<typeof storedDevice>;

export type DeviceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type DeviceOutcome =
  | { status: "member"; member: z.infer<typeof currentMember>; token: string }
  | { status: "not-member" }
  | { status: "signed-out" };

// The Installed App keeps its Device across launches; the Mini App never touches this storage.
function storedDeviceIn(storage: DeviceStorage): StoredDevice | undefined {
  try {
    return storedDevice.parse(JSON.parse(storage.getItem(deviceKey) ?? ""));
  } catch {
    return undefined;
  }
}

function deviceStoreOf(storage: DeviceStorage) {
  const current = atom(storedDeviceIn(storage), "session.device");

  return {
    read: () => current(),
    keep(device: StoredDevice) {
      storage.setItem(deviceKey, JSON.stringify(device));
      current.set(device);
    },
    forget() {
      storage.removeItem(deviceKey);
      current.set(undefined);
    },
  };
}

type DeviceStore = ReturnType<typeof deviceStoreOf>;

async function signInWithLogin(
  { client, devices }: { client: HttpClient; devices: DeviceStore },
  login: TelegramWidgetLogin,
): Promise<DeviceOutcome> {
  const signedIn = await wrap(
    client.request("/api/session/telegram-login", {
      method: "POST",
      body: login,
      withoutSession: true,
      schema: deviceSignIn,
    }),
  );

  devices.keep(signedIn.device);

  return { status: "member", member: currentMember.parse(signedIn), token: signedIn.token };
}

// A refused Device is forgotten, and the Installed App goes back to its sign-in screen.
async function signInWithDevice({
  client,
  devices,
}: {
  client: HttpClient;
  devices: DeviceStore;
}): Promise<DeviceOutcome> {
  const device = devices.read();

  if (device === undefined) {
    return { status: "signed-out" };
  }

  try {
    const session = await wrap(
      client.request("/api/session/device", {
        method: "POST",
        body: { credential: device.credential },
        withoutSession: true,
        schema: deviceSession,
      }),
    );

    return { status: "member", member: currentMember.parse(session), token: session.token };
  } catch (error) {
    if (refusalOf(error, { DEVICE_INVALID: true }) !== true) {
      throw error;
    }

    devices.forget();

    return { status: "signed-out" };
  }
}

function signInAsDeviceOf(client: HttpClient, devices: DeviceStore) {
  return async (login?: TelegramWidgetLogin): Promise<DeviceOutcome> => {
    try {
      return await wrap(
        login === undefined
          ? signInWithDevice({ client, devices })
          : signInWithLogin({ client, devices }, login),
      );
    } catch (error) {
      if (refusalOf(error, { NOT_A_MEMBER: true }) === true) {
        return { status: "not-member" };
      }

      throw error;
    }
  };
}

// Requests that get 401 together share one sign-in instead of each starting its own.
function reauthenticateOf(signInAsDevice: ReturnType<typeof signInAsDeviceOf>) {
  let pending: Promise<string | undefined> | undefined;

  return async (): Promise<string | undefined> => {
    pending ??= signInAsDevice()
      .then((outcome) => (outcome.status === "member" ? outcome.token : undefined))
      .catch(noop)
      .finally(() => {
        pending = undefined;
      });

    return wrap(pending);
  };
}

// Signing out revokes the Device on the server too, so its subscription stops getting Push.
async function revokeDevice(client: HttpClient, deviceId: string): Promise<void> {
  await wrap(
    client
      .request(`/api/devices/${deviceId}`, { method: "DELETE", schema: deleted })
      .then(noop, noop),
  );
}

export function createSessionApi(client: HttpClient, storage: DeviceStorage) {
  const devices = deviceStoreOf(storage);
  const signInAsDevice = signInAsDeviceOf(client, devices);

  return {
    async signIn(initData: string) {
      const session = await wrap(
        client.request("/api/session", {
          method: "POST",
          body: { initData },
          withoutSession: true,
          schema: sessionResponse,
        }),
      );

      return session.status === "stranger"
        ? session
        : { status: session.status, member: currentMember.parse(session), token: session.token };
    },
    signInAsDevice,
    // A 401 on the way is tried once more through the Device; nothing is kept on failure.
    reauthenticate: reauthenticateOf(signInAsDevice),
    currentDeviceId: () => devices.read()?.id,
    async signOut() {
      const device = devices.read();

      if (device !== undefined) {
        await wrap(revokeDevice(client, device.id));
      }

      devices.forget();
      client.isSessionLost.setTrue();
    },
    startSession: (token: string) => {
      client.token.set(token);
      client.isSessionLost.setFalse();
    },
    isSessionLost: client.isSessionLost,
  };
}

export type SessionApi = ReturnType<typeof createSessionApi>;
