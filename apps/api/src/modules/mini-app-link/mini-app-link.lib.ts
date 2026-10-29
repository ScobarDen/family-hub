import { encodeDeepLink, type DeepLink } from "@family-hub/contract";

import type { BotApi } from "@/modules/telegram";

// Built per request or cron tick, so the bot's name is asked of Telegram at most once in either.
export function createMiniAppLinks(bot: BotApi) {
  let username: Promise<string> | undefined;

  async function botUsername(): Promise<string> {
    // oxlint-disable-next-line unicorn/no-useless-undefined -- BotApi.call always takes params; getMe has none
    username ??= bot.call("getMe", undefined).then((me) => me.username);

    try {
      return await username;
    } catch (error) {
      username = undefined;
      throw error;
    }
  }

  return {
    // The bot's Main Mini App opens from t.me/<bot>, so the link needs no app short name.
    async appLink(deepLink?: DeepLink): Promise<string> {
      const base = `https://t.me/${await botUsername()}`;

      return deepLink === undefined
        ? `${base}?startapp`
        : `${base}?startapp=${encodeDeepLink(deepLink)}`;
    },
    chatLink: async (): Promise<string> => `https://t.me/${await botUsername()}`,
  };
}

export type MiniAppLinks = ReturnType<typeof createMiniAppLinks>;
