import type { AppModule } from "@family-hub/contract";

// The tabs the navigation switches between: the tab bar's on a narrow window, the sidebar's on a wide one.
export type NavigationTab = "today" | "sections" | AppModule | "profile";
