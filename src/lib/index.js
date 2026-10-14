export { ensureNumber } from './number.js';
export {
  getVisualFilterVars,
  getTextFilterVars,
  PREVIEW_TEXT_DEFAULTS,
  PREVIEW_TEXT_VAR_NAMES,
  PREVIEW_VISUAL_DEFAULTS,
  PREVIEW_VISUAL_VAR_NAMES,
  ROOT_TEXT_VAR_NAMES,
  ROOT_VISUAL_VAR_NAMES,
} from './filterCssVars.js';
export { createScrollBatcher } from './scrollBatcher.js';
export { createSeededRandom, shuffleWords } from './textShuffle.js';
export {
  formatTime,
  getLocalDateStr,
  getTodayDateStr,
  getYesterdayDateStr,
  reconcileHourlyToTotal,
  ensure24Array,
} from './time.js';
export {
  extendTimeWindowUntil,
  getTimeWindowRemainingMs,
  isTimeWindowActive,
  normalizeTimeWindowTimestamp,
  resolveTimeWindowUntil,
} from './timeWindow.js';
export { getHostname } from './url.js';
export { isHostnameInList, isHostnameMatch } from './domain.js';
export {
  buildExactOriginPatternForUrl,
  buildOriginPatternsForDomain,
  getUniqueOrigins,
  hasOriginPermissionForDomain,
  isConcreteOriginPermissionPattern,
  isValidDomainForOriginPermission,
  requireConcreteOriginPermissions,
} from './permissions.js';
export {
  getSunTimes,
  getMinutesFromDate,
  DEFAULT_SUNRISE_MIN,
  DEFAULT_SUNSET_MIN,
  getSolarPosition,
  getSolarState,
  resolveSolarPhaseByAltitude,
  SOLAR_PHASES,
  normalizeLatitude,
  normalizeLongitude,
} from './solarCalculations.js';
export {
  estimateSleepPattern,
  resolveWakeUpHour,
  resolveWakeActivityHour,
  findFirstActiveHour,
  findFirstActiveHourAfter,
  findFirstActiveHourInWindow,
  getVirtualDay,
  getVirtualDayByBoundary,
  getCycleBoundary,
  ACTIVE_HOUR_THRESHOLD_MS,
  DEFAULT_WAKE_WINDOW_HOURS,
  MIN_SLEEP_GAP_HOURS,
  MAX_SLEEP_GAP_HOURS,
  IDLE_HOUR_THRESHOLD_MINUTES,
  CIRCADIAN_WEIGHTS,
} from './sleepPattern.js';
export { getSiteCategory, SITE_CATEGORY } from './siteClassifier.js';
export { isMeaningfulText } from './textFilters.js';
export { isLikelyEmojiOrIcon } from './visualHeuristics.js';
export {
  PERSONAL_BASELINE_METRIC_DIRECTIONS,
  PERSONAL_BASELINE_METRIC_GRAINS,
  PERSONAL_BASELINE_REFERENCE_MODES,
  PERSONAL_BASELINE_ROLES,
  PERSONAL_BASELINE_STATUSES,
} from './personalBaselineContract.js';
