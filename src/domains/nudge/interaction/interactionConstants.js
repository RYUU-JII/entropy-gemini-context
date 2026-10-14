// Shared constants for the click-intent gate / enso-gate / scroll-friction interaction runtime.
// Pure values only; no side effects.

export const SPECIAL_LINK_SELECTOR = 'a[download], a[href^="blob:"], a[href^="data:"], a[href^="javascript:"]';
export const FORM_CONTROL_SELECTOR = 'input, textarea, select, option, label';
export const CLICK_REWARD_DRIFT_THRESHOLD = 3.2;
export const CLICK_REWARD_DRIFT_TIME_CONSTANT_MS = 15 * 60 * 1000;
export const CLICK_REWARD_DRIFT_IDLE_RESET_MS = 45 * 60 * 1000;
export const CLICK_REWARD_DRIFT_FIRST_GRACE_MS = 8 * 60 * 1000;
export const CLICK_REWARD_DRIFT_MAX_FIRST_WAIT_MS = 25 * 60 * 1000;
export const CLICK_REWARD_DRIFT_MAX_REPEAT_WAIT_MS = 30 * 60 * 1000;
export const CLICK_REWARD_DRIFT_PENDING_MAX_AGE_MS = 10 * 60 * 1000;
export const CLICK_REWARD_DRIFT_TIME_CAP_MIN_CONFIDENCE = 0.76;
export const CLICK_ENSO_SUPPRESSION_MS = 420;
export const CLICK_ENSO_ENTRY_MS = 720;
export const CLICK_ENSO_INK_SETTLE_MS = 620;
export const CLICK_ENSO_LEAVE_FEEDBACK_MS = 1320;
export const CLICK_ENSO_CONTINUE_RELEASE_MS = 160;
export const CLICK_ENSO_NEUTRAL_RELEASE_MS = 520;
export const CLICK_ENSO_GATE_FORCE_ENTRY_DEBUG = false;
export const CLICK_ENSO_GATE_STYLE_ID = 'friction-click-enso-gate-style';
// Petals lift from the circle's perimeter, then drift in one quiet current.
export const CLICK_ENSO_LEAVE_CEREMONY_PETALS = Object.freeze([
  { angle: -158, distance: 1.12, dx: 26, dy: 38, rotate: -26, delay: 0, scale: 0.82 },
  { angle: -127, distance: 1.06, dx: 34, dy: 24, rotate: 18, delay: 50, scale: 1 },
  { angle: -99, distance: 1.2, dx: 42, dy: 30, rotate: -14, delay: 110, scale: 0.76 },
  { angle: -72, distance: 1.08, dx: 32, dy: 42, rotate: 32, delay: 30, scale: 0.94 },
  { angle: -44, distance: 1.18, dx: 48, dy: 28, rotate: -22, delay: 160, scale: 0.86 },
  { angle: -17, distance: 1.1, dx: 38, dy: 44, rotate: 12, delay: 80, scale: 1.04 },
  { angle: 14, distance: 1.14, dx: 44, dy: 38, rotate: -32, delay: 140, scale: 0.78 },
  { angle: 42, distance: 1.12, dx: 32, dy: 48, rotate: 24, delay: 60, scale: 0.9 },
  { angle: 72, distance: 1.22, dx: 28, dy: 34, rotate: -16, delay: 180, scale: 0.68 },
  { angle: 104, distance: 1.1, dx: 24, dy: 42, rotate: 28, delay: 100, scale: 0.84 },
  { angle: 155, distance: 1.15, dx: 32, dy: 30, rotate: -18, delay: 120, scale: 0.74 },
  { angle: 186, distance: 1.08, dx: 28, dy: 44, rotate: 22, delay: 40, scale: 0.92 },
]);
export const SENSITIVE_FORM_FIELD_SELECTOR = [
  'input[type="password"]',
  'input[type="email"]',
  'input[type="tel"]',
  'input[type="file"]',
].join(', ');
export const SENSITIVE_AUTOCOMPLETE_TOKENS = new Set([
  'username',
  'email',
  'current-password',
  'new-password',
  'one-time-code',
  'tel',
  'tel-country-code',
  'tel-national',
  'tel-area-code',
  'tel-local',
  'tel-extension',
  'street-address',
  'address-line1',
  'address-line2',
  'address-line3',
  'postal-code',
  'country',
  'country-name',
  'name',
  'given-name',
  'additional-name',
  'family-name',
  'transaction-currency',
  'transaction-amount',
]);
