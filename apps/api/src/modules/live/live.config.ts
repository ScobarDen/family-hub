import type { AppModule } from "@family-hub/contract";

// «Готово» completes a Task Occurrence, which a Pet card shows too.
export const reminderCallbackModules: AppModule[] = ["tasks", "pet"];
