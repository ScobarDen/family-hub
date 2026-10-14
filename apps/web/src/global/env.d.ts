// Declaration merging with the Vite globals needs an interface.
/* oxlint-disable typescript/consistent-type-definitions */
declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
  }
}
/* oxlint-enable typescript/consistent-type-definitions */
