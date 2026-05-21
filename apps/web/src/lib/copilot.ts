import type { CopilotPlatform } from '../mock/types';

// Mock Live Co-pilot desktop-app metadata + helpers (M19). The desktop app
// itself is out of scope for this web prototype — everything here is a
// believable stand-in so the web surfaces (the `/copilot` screen, the
// launch-from-opportunity action) render and behave convincingly for the demo.

// The mock desktop-app version, shown once the app is "installed".
export const COPILOT_APP_VERSION = '1.2.0';

// Approximate installer size, shown on the download screen. Mock figure.
export const COPILOT_DOWNLOAD_SIZE = '118 MB';

export const COPILOT_PLATFORM_LABELS: Record<CopilotPlatform, string> = {
  macos: 'macOS',
  windows: 'Windows',
};

// The minimum OS each build supports — shown in the system-requirements panel.
// [FLAG] real minimums depend on the desktop framework + OS entitlements.
export const COPILOT_OS_REQUIREMENTS: Record<CopilotPlatform, string> = {
  macos: 'macOS 12 Monterey or later',
  windows: 'Windows 10 (64-bit) or later',
};

// Best-effort OS detection so the download screen can promote the build the rep
// most likely wants. Both builds are always offered regardless — this only
// decides which one gets the primary button. Falls back to macOS.
export function detectOs(): CopilotPlatform {
  if (typeof navigator === 'undefined') return 'macos';
  const hint = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (hint.includes('win')) return 'windows';
  return 'macos';
}

// The mock deep link the web app hands off to the installed desktop app. With an
// opportunity id it binds the call to that deal (the launch-from-opportunity
// happy path); without one the app opens to its own opportunity picker (M20).
// [FLAG] the real handshake (custom URL scheme vs. token exchange) is an
// implementation detail left to the desktop build.
export function copilotDeepLink(opportunityId?: string): string {
  return opportunityId
    ? `pitchgenius://session/${opportunityId}`
    : 'pitchgenius://launch';
}
