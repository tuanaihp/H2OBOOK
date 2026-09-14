// Single application version. Every API route, page title and UI badge reads from here so the app
// can no longer report five different numbers. tests/unit/version.test.ts keeps it in lockstep with
// package.json and the VERSION file — bump all three together.
export const APP_VERSION = "4.21.0";
export const APP_VERSION_SHORT = APP_VERSION.split(".").slice(0, 2).join(".");

// The Unified Input engine has its own contract version (import format / session schema). It is not
// the app version and must only change when that contract changes.
export const INPUT_ENGINE_VERSION = "4.13.7";
