import { reatomComponent } from "@reatom/react";
import { createContext, useContext, type ReactNode } from "react";

const WideWindowContext = createContext(false);

export const WideWindow = reatomComponent(
  ({ isWide, children }: { isWide: () => boolean; children: ReactNode }) => (
    <WideWindowContext value={isWide()}>{children}</WideWindowContext>
  ),
  "WideWindow",
);

export function useIsWideWindow(): boolean {
  return useContext(WideWindowContext);
}
