export {
  deepLinkParameter,
  reatomBrowserWebApp,
  type BrowserBack,
  type BrowserWindow,
} from "./browser.model.ts";
export {
  didSucceedOrAlert,
  isConfirmed,
  type ClosingConfirmation,
  type Confirmation,
  type Dialogs,
  type Fullscreen,
  type Haptics,
  type HomeScreen,
} from "./telegram.lib.ts";
export {
  fakeBottomButton,
  fakeDeviceStorage,
  fakeHaptics,
  fakeWindow,
  type FakeBottomButton,
  type FakeDeviceStorage,
  type FakeHaptics,
  type FakeWindow,
} from "./telegram.fixtures.ts";
export { reatomTelegram, type BottomButtonState, type Telegram } from "./telegram.model.ts";
export { BrowserBackButton } from "./view/browser-back.view.tsx";
export type {
  DeviceStorage,
  HapticImpact,
  HomeScreenStatus,
  PopupParams,
} from "./telegram.types.ts";
