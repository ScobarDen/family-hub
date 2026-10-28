import { bindFirst } from "@/common/bind";

import type { CommandDependencies } from "../command.types.ts";
import { handleCommandCallback } from "./callback.service.ts";
import { createMiniAppCommands } from "./mini-app.service.ts";
import { handleRemind, handleText } from "./text.service.ts";
import { handleVoice } from "./voice.service.ts";

export function createCommandService(dependencies: CommandDependencies) {
  return {
    ...bindFirst(dependencies, {
      handleText,
      handleRemind,
      handleVoice,
      handleCallback: handleCommandCallback,
    }),
    miniApp: createMiniAppCommands(dependencies),
    // A draft nobody confirmed within a day is gone by the 03:00 UTC maintenance.
    sweep: async () => dependencies.drafts.sweep(dependencies.clock.now()),
  };
}

export type CommandService = ReturnType<typeof createCommandService>;
