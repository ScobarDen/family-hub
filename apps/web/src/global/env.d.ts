// Declaration merging with the Vite globals needs an interface.
/* oxlint-disable typescript/consistent-type-definitions */
declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    // The bot whose Telegram Login the Installed App signs in with.
    readonly VITE_BOT_USERNAME?: string;
  }
}
/* oxlint-enable typescript/consistent-type-definitions */
