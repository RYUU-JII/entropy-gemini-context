import { requireGlobalGoal } from '../../settings/config/siteRules.js';
import { PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT } from '../../progression/policy/progressionJourneyPolicy.js';

export const GUIDANCE_REVISION = 1;
export const GUIDANCE_FAMILIES = Object.freeze(['lens', 'gate', 'flare', 'brake', 'barrier', 'echo', 'veil']);
export const GUIDANCE_IDS = Object.freeze([
  'popup.first_setup', 'garden.first_site', 'site.goal_scope', 'garden.bonsai_growth',
  'main.pressure_ready', 'flare.first_installation', 'schedule.first_setup',
  'settings.recording_scope', 'settings.notification_opt_in', 'journey.stage_change',
  ...GUIDANCE_FAMILIES.map((id) => `artifact.${id}.first_setup`),
]);
const ids = new Set(GUIDANCE_IDS);
export function requireGuidanceId(value) {
  if (!ids.has(value)) throw new Error('GUIDANCE_ID_INVALID');
  return value;
}
export function requireGuidanceString(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 256) throw new Error('GUIDANCE_IDENTITY_INVALID');
  return value;
}
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('GUIDANCE_STATE_INVALID');
}
function exact(value, keys) {
  object(value);
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new Error('GUIDANCE_STATE_SHAPE_INVALID');
}
export function requireGuidanceTime(value) {
  if (!Number.isInteger(value) || value < 0) throw new Error('GUIDANCE_TIMESTAMP_INVALID');
  return value;
}
export function requireGuidanceGoal(value) {
  requireGlobalGoal(value);
  if (value === 0) throw new Error('GUIDANCE_GLOBAL_GOAL_INVALID');
  return value;
}
export function buildGuidanceState() {
  return { version: 1, receipts: {}, installation: null, pendingIntent: null,
    lastPresentedJourneyDay: 0, delivery: { day: 0, activityDayKey: null, status: 'idle' } };
}
function day(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT) {
    throw new Error('GUIDANCE_JOURNEY_DAY_INVALID');
  }
}
function previewDay(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('GUIDANCE_PREVIEW_DAY_INVALID');
}
export function requireGuidanceInstallation(value) {
  exact(value, ['status', 'intentId', 'globalGoalMinutes', 'settingsVersion', 'installedAtMs', 'source']);
  if (value.status !== 'installed' || !['settings_ack', 'configuration_reconciled', 'existing_configuration'].includes(value.source)) throw new Error('GUIDANCE_INSTALLATION_INVALID');
  requireGuidanceString(value.intentId); requireGuidanceGoal(value.globalGoalMinutes); requireGuidanceTime(value.installedAtMs);
  if (value.settingsVersion !== null) requireGuidanceTime(value.settingsVersion);
  return value;
}
export function requireGuidanceIntent(value) {
  exact(value, ['intentId', 'settingsCommandId', 'globalGoalMinutes', 'preparedAtMs', 'profileGeneration']);
  requireGuidanceString(value.intentId); requireGuidanceString(value.settingsCommandId);
  requireGuidanceString(value.profileGeneration); requireGuidanceGoal(value.globalGoalMinutes); requireGuidanceTime(value.preparedAtMs);
  return value;
}
export function requireGuidanceState(value) {
  exact(value, ['version', 'receipts', 'installation', 'pendingIntent', 'lastPresentedJourneyDay', 'delivery']);
  if (value.version !== 1) throw new Error('GUIDANCE_VERSION_INVALID');
  object(value.receipts);
  for (const [id, receipt] of Object.entries(value.receipts)) {
    requireGuidanceId(id); exact(receipt, ['revision', 'presentedAtMs', 'dismissedAtMs', 'completedAtMs']);
    if (receipt.revision !== GUIDANCE_REVISION) throw new Error('GUIDANCE_REVISION_INVALID');
    for (const key of ['presentedAtMs', 'dismissedAtMs', 'completedAtMs']) if (receipt[key] !== null) requireGuidanceTime(receipt[key]);
    if (receipt.presentedAtMs === null && (receipt.dismissedAtMs !== null || receipt.completedAtMs !== null)) throw new Error('GUIDANCE_RECEIPT_ORDER_INVALID');
  }
  if (value.installation !== null) requireGuidanceInstallation(value.installation);
  if (value.pendingIntent !== null) requireGuidanceIntent(value.pendingIntent);
  day(value.lastPresentedJourneyDay);
  exact(value.delivery, ['day', 'activityDayKey', 'status']); day(value.delivery.day);
  if (value.delivery.activityDayKey !== null) requireGuidanceString(value.delivery.activityDayKey);
  if (!['idle', 'reserved', 'sent', 'skipped', 'delivery_uncertain'].includes(value.delivery.status)) throw new Error('GUIDANCE_DELIVERY_STATUS_INVALID');
  return value;
}
export function buildGuidanceSession() {
  return { version: 1, claim: null, previewState: buildGuidanceState(), previewDay: null };
}
export function requireGuidanceSession(value) {
  exact(value, ['version', 'claim', 'previewState', 'previewDay']);
  if (value.version !== 1) throw new Error('GUIDANCE_SESSION_VERSION_INVALID');
  requireGuidanceState(value.previewState);
  if (value.previewDay !== null) previewDay(value.previewDay);
  if (value.claim !== null) {
    exact(value.claim, ['claimId', 'guideId', 'revision', 'hostId', 'documentId', 'owner', 'profileGeneration', 'expiresAtMs', 'preview', 'replay', 'journeyDay', 'installationGoalMinutes']);
    for (const key of ['claimId', 'hostId', 'documentId', 'owner', 'profileGeneration']) requireGuidanceString(value.claim[key]);
    requireGuidanceId(value.claim.guideId); requireGuidanceTime(value.claim.expiresAtMs); day(value.claim.journeyDay);
    if (value.claim.revision !== 1 || typeof value.claim.preview !== 'boolean' || typeof value.claim.replay !== 'boolean') throw new Error('GUIDANCE_CLAIM_INVALID');
    if (value.claim.guideId === 'flare.first_installation') requireGuidanceGoal(value.claim.installationGoalMinutes);
    else if (value.claim.installationGoalMinutes !== null) throw new Error('GUIDANCE_CLAIM_INVALID');
  }
  return value;
}
