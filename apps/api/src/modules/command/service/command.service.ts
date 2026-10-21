import type { CallbackQuery, Message, Voice } from "@grammyjs/types";

import type { CommandDependencies } from "../command.types.ts";
import { handleCommandCallback } from "./callback.service.ts";
import { handleText } from "./text.service.ts";
import { handleVoice } from "./voice.service.ts";

export function createCommandService(dependencies: CommandDependencies) {
  return {
    handleText: async (message: Message) => handleText(dependencies, message),
    handleVoice: async (message: Message & { voice: Voice }) => handleVoice(dependencies, message),
    handleCallback: async (query: CallbackQuery) => handleCommandCallback(dependencies, query),
    // A draft nobody confirmed within a day is gone by the 03:00 UTC maintenance.
    sweep: async () => dependencies.drafts.sweep(dependencies.clock.now()),
  };
}

export type CommandService = ReturnType<typeof createCommandService>;
