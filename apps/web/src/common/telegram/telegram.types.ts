export type ColorScheme = "light" | "dark";

type WebAppEvent = "themeChanged";

// Declaration merging with the DOM global needs an interface.
/* oxlint-disable typescript/consistent-type-definitions */
declare global {
  interface Window {
    Telegram: { WebApp: TelegramWebApp };
  }
}
/* oxlint-enable typescript/consistent-type-definitions */

export type TelegramButton = {
  show(): void;
  hide(): void;
  onClick(handler: () => void): void;
  offClick(handler: () => void): void;
};

export type PopupButton = {
  id: string;
  type?: "default" | "ok" | "close" | "cancel" | "destructive";
  text?: string;
};

export type PopupParams = { title?: string; message: string; buttons: PopupButton[] };

export type HapticImpact = "light" | "medium" | "heavy" | "rigid" | "soft";

type StorageCallback<Result> = (error: string | null, result?: Result) => void;

export type DeviceStorage = {
  setItem(key: string, value: string, callback?: StorageCallback<boolean>): void;
  getItem(key: string, callback: StorageCallback<string | null>): void;
  removeItem(key: string, callback?: StorageCallback<boolean>): void;
  clear(callback?: StorageCallback<boolean>): void;
};

export type TelegramWebApp = {
  initData: string;
  initDataUnsafe: { start_param?: string };
  platform: string;
  colorScheme: ColorScheme;
  ready(): void;
  expand(): void;
  showAlert(message: string, callback?: () => void): void;
  showPopup(params: PopupParams, callback?: (buttonId: string | null) => void): void;
  isVersionAtLeast(version: string): boolean;
  requestWriteAccess(callback?: (isAllowed: boolean) => void): void;
  shareMessage(preparedMessageId: string, callback?: (isSent: boolean) => void): void;
  openTelegramLink(url: string): void;
  HapticFeedback: { impactOccurred(style: HapticImpact): void };
  enableVerticalSwipes(): void;
  disableVerticalSwipes(): void;
  DeviceStorage: DeviceStorage;
  BackButton: TelegramButton;
  SettingsButton: TelegramButton;
  onEvent(event: WebAppEvent, handler: () => void): void;
  offEvent(event: WebAppEvent, handler: () => void): void;
};
