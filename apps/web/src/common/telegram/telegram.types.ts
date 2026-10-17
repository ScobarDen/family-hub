export type ThemeParams = Partial<
  Record<
    | "bg_color"
    | "text_color"
    | "hint_color"
    | "link_color"
    | "button_color"
    | "button_text_color"
    | "secondary_bg_color"
    | "header_bg_color"
    | "bottom_bar_bg_color"
    | "accent_text_color"
    | "section_bg_color"
    | "section_header_text_color"
    | "section_separator_color"
    | "subtitle_text_color"
    | "destructive_text_color",
    string
  >
>;

export type ColorScheme = "light" | "dark";

export type SafeAreaInset = { top: number; bottom: number; left: number; right: number };

export type Viewport = { height: number; stableHeight: number; isExpanded: boolean };

type WebAppEvent =
  | "themeChanged"
  | "viewportChanged"
  | "safeAreaChanged"
  | "contentSafeAreaChanged";

// Declaration merging with the DOM global needs an interface.
/* oxlint-disable typescript/consistent-type-definitions */
declare global {
  interface Window {
    Telegram: { WebApp: TelegramWebApp };
  }
}
/* oxlint-enable typescript/consistent-type-definitions */

export type TelegramWebApp = {
  initData: string;
  platform: string;
  colorScheme: ColorScheme;
  themeParams: ThemeParams;
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;
  safeAreaInset?: SafeAreaInset;
  contentSafeAreaInset?: SafeAreaInset;
  ready(): void;
  expand(): void;
  showAlert(message: string, callback?: () => void): void;
  isVersionAtLeast(version: string): boolean;
  requestWriteAccess(callback?: (isAllowed: boolean) => void): void;
  onEvent(event: WebAppEvent, handler: () => void): void;
  offEvent(event: WebAppEvent, handler: () => void): void;
};
