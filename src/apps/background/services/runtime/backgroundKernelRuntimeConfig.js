import { PREPAINT_VISUAL_STYLES } from '../../../../domains/protection/content/prepaintVisualAssets.js';
import { STATS_RANGE_MAX_DAYS } from '../../../../domains/stats/contracts/statsContracts.js';

export const MANAGED_CONTENT_SCRIPT_ID = 'entropy-managed-protection-v1';
export const MANAGED_CONTENT_SCRIPT_FILES = ['src/apps/content/loader.js'];
export const MEDIA_FRAME_CONTENT_SCRIPT = Object.freeze({
  id: 'entropy-media-frame-probe-v1',
  js: ['src/apps/content/mediaFrameProbe.js'],
});
export const PREPAINT_VISUAL_CONTENT_SCRIPTS = Object.freeze(
  PREPAINT_VISUAL_STYLES.map(({ id, tierId, path }) => Object.freeze({
    id,
    tierId,
    css: [path],
  })),
);

export const TRACKING_INTERVAL_MS = 60_000;
export const MEMORY_PURGE_RECENT_HISTORY_WINDOW_MS = 10 * 60_000;
export const MAX_DAYS_STORED = STATS_RANGE_MAX_DAYS;
