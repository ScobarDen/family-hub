import { noop, wrap } from "@reatom/core";
import { z } from "zod";

import {
  currentMember,
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
function deviceStoreOf(storage: DeviceStorage) {
  return {
    read(): StoredDevice | undefined {
      try {
        return storedDevice.parse(JSON.parse(storage.getItem(deviceKey) ?? ""));
      } catch {
        return undefined;
      }
    },
    keep(device: StoredDevice) {
      storage.setItem(deviceKey, JSON.stringify(device));
    },
    forget() {
      storage.removeItem(deviceKey);
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
    async reauthenticate(): Promise<string | undefined> {
      const outcome = await wrap(signInAsDevice().catch(noop));

      return outcome?.status === "member" ? outcome.token : undefined;
    },
    currentDeviceId: () => devices.read()?.id,
    signOut() {
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
