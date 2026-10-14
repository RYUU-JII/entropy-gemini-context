import {
  setText,
  toggleClass,
} from '../visual/index.js';
import { resolveGlobalSentinelPageFault } from '../nudge/nudgeGameGlobalSentinelEntryFaults.js';

export function applyGlobalStarterFeedbackDom({
  root = null,
  scene = null,
  point = null,
} = {}) {
  const normalizedPoint = point || { xRatio: 0.5, yRatio: 0.48 };
  if (root) {
    root.style.setProperty('--nudge-global-starter-feedback-x', `${(normalizedPoint.xRatio * 100).toFixed(2)}%`);
    root.style.setProperty('--nudge-global-starter-feedback-y', `${(normalizedPoint.yRatio * 100).toFixed(2)}%`);
  }
  if (scene) {
    toggleClass(scene, 'is-global-starter-feedback', true);
  }
}

export function clearGlobalStarterFeedbackDom(scene = null) {
  if (scene) toggleClass(scene, 'is-global-starter-feedback', false);
}

export function applyGlobalRiftTargetDom({
  root = null,
  point = null,
} = {}) {
  if (!root) return false;
  const sourceX = Number(point?.xRatio);
  const sourceY = Number(point?.yRatio);
  if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY)) {
    throw new Error('global_sentinel_rift_target_point_invalid');
  }
  const xRatio = Math.max(0, Math.min(1, sourceX));
  const yRatio = Math.max(0, Math.min(1, sourceY));
  // These variables position only the semantic hit target. The worker canvas
  // remains the sole owner of the visible crack and aperture geometry.
  root.style.setProperty('--nudge-rift-target-x', `${(xRatio * 100).toFixed(2)}%`);
  root.style.setProperty('--nudge-rift-target-y', `${(yRatio * 100).toFixed(2)}%`);
  return true;
}

export function applyGlobalRuptureRevealDom({
  scene = null,
  presentation = null,
  reducedMotion = false,
} = {}) {
  const safePresentation = presentation || {
    active: false,
  };
  if (scene) {
    toggleClass(scene, 'is-global-sentinel-rupture-reveal', safePresentation.active);
    const fault = safePresentation.active && !reducedMotion
      ? resolveGlobalSentinelPageFault(safePresentation.timeline.elapsedMs) : { active: false };
    toggleClass(scene, 'is-global-lcd-row-fault', fault.active);
    if (fault.active) {
      scene.style.setProperty('--nudge-lcd-row-y', `${12 + (fault.index * 29 % 63)}%`);
      scene.style.setProperty('--nudge-lcd-row-polarity', fault.phase > 0 ? '0.92' : '0.25');
    }
  }
}

export function applyGlobalSentinelActionDom({
  button = null,
  presentation = null,
  label = '',
  modalOpen = false,
} = {}) {
  if (!button) return false;
  const action = presentation && typeof presentation === 'object'
    ? presentation
    : {};
  const mode = typeof action.mode === 'string' ? action.mode : '';
  const enabled = action.enabled === true && modalOpen !== true;
  const normalizedLabel = typeof label === 'string' ? label.trim() : '';
  if (enabled && !normalizedLabel) {
    throw new Error(`global_sentinel_action_label_missing:${mode || 'unknown'}`);
  }
  const previousMode = button.dataset.globalActionMode || '';
  const wasEnabled = button.dataset.globalActionEnabled === 'true';
  button.dataset.globalActionMode = mode;
  button.dataset.globalActionEnabled = enabled ? 'true' : 'false';
  button.hidden = !enabled;
  button.disabled = !enabled;
  button.tabIndex = enabled ? 0 : -1;
  button.setAttribute('aria-hidden', enabled ? 'false' : 'true');
  button.setAttribute('aria-label', normalizedLabel);
  setText(button, normalizedLabel);
  if (enabled && (!wasEnabled || previousMode !== mode)) {
    button.focus?.({ preventScroll: true });
  }
  return enabled;
}

export function applySiteFurinActionDom({
  button = null,
  presentation = null,
  label = '',
  modalOpen = false,
} = {}) {
  if (!button) return false;
  const action = presentation && typeof presentation === 'object'
    ? presentation
    : {};
  const mode = typeof action.mode === 'string' ? action.mode : '';
  const enabled = action.enabled === true && modalOpen !== true;
  const normalizedLabel = typeof label === 'string' ? label.trim() : '';
  if (enabled && !normalizedLabel) {
    throw new Error(`site_furin_action_label_missing:${mode || 'unknown'}`);
  }
  button.dataset.siteFurinActionMode = mode;
  button.dataset.siteFurinActionEnabled = enabled ? 'true' : 'false';
  button.hidden = !enabled;
  button.disabled = !enabled;
  button.tabIndex = enabled ? 0 : -1;
  button.setAttribute('aria-hidden', enabled ? 'false' : 'true');
  button.setAttribute('aria-label', normalizedLabel);
  setText(button, normalizedLabel);
  return enabled;
}

export function applyGlobalSentinelOutcomeStatusDom({
  status = null,
  text = null,
} = {}) {
  if (!status) return false;
  const announcement = typeof text?.outcomeAnnouncement === 'string'
    ? text.outcomeAnnouncement.trim()
    : '';
  const key = typeof text?.outcomeAnnouncementKey === 'string'
    ? text.outcomeAnnouncementKey.trim()
    : '';
  if (!announcement || !key) {
    delete status.dataset.globalOutcomeAnnouncementKey;
    delete status.dataset.globalOutcomeAnnouncementText;
    return setText(status, '');
  }
  if (
    status.dataset.globalOutcomeAnnouncementKey === key
    && status.dataset.globalOutcomeAnnouncementText === announcement
  ) {
    return false;
  }
  status.dataset.globalOutcomeAnnouncementKey = key;
  status.dataset.globalOutcomeAnnouncementText = announcement;
  return setText(status, announcement);
}

function applyRitualPhaseAnnouncementDom({
  ritualGuide = null,
  text = null,
  visible = false,
} = {}) {
  if (!ritualGuide) return false;
  const announcement = typeof text?.phaseAnnouncement === 'string'
    ? text.phaseAnnouncement.trim()
    : '';
  const key = typeof text?.announcementKey === 'string'
    ? text.announcementKey.trim()
    : '';
  if (!visible || !announcement || !key) {
    ritualGuide.removeAttribute('aria-label');
    delete ritualGuide.dataset.ritualAnnouncementKey;
    delete ritualGuide.dataset.ritualAnnouncementText;
    return false;
  }
  if (
    ritualGuide.dataset.ritualAnnouncementKey === key
    && ritualGuide.dataset.ritualAnnouncementText === announcement
  ) {
    return true;
  }
  ritualGuide.dataset.ritualAnnouncementKey = key;
  ritualGuide.dataset.ritualAnnouncementText = announcement;
  ritualGuide.setAttribute('aria-label', announcement);
  return true;
}

export function applySentinelRitualProgressDom({
  root = null,
  scene = null,
  ritualGuide = null,
  ritualTitle = null,
  ritualBody = null,
  ritualHint = null,
  siteFurinAction = null,
  globalSentinelAction = null,
  globalSentinelStatus = null,
  modalOpen = false,
  progress = null,
  text = null,
  presentation = null,
  ritualGuideVisible = false,
  applyRuptureReveal = null,
} = {}) {
  const safeProgress = progress && typeof progress === 'object' ? progress : {};
  const safePresentation = presentation && typeof presentation === 'object' ? presentation : {};
  const sceneClasses = safePresentation.sceneClasses && typeof safePresentation.sceneClasses === 'object'
    ? safePresentation.sceneClasses
    : {};
  const styleVars = safePresentation.styleVars && typeof safePresentation.styleVars === 'object'
    ? safePresentation.styleVars
    : {};

  toggleClass(scene, 'is-ritual-active', !modalOpen);
  toggleClass(scene, 'is-ritual-ready', safeProgress.ready);
  toggleClass(scene, 'is-ritual-failed', safeProgress.failed);
  for (const [className, enabled] of Object.entries(sceneClasses)) {
    toggleClass(scene, className, enabled);
  }
  toggleClass(scene, 'is-ritual-guide-visible', ritualGuideVisible);
  if (root) {
    for (const [name, value] of Object.entries(styleVars)) {
      root.style.setProperty(name, value);
    }
  }
  if (typeof applyRuptureReveal === 'function') {
    applyRuptureReveal();
  }
  applyGlobalSentinelActionDom({
    button: globalSentinelAction,
    presentation: safePresentation.globalAction,
    label: text?.globalActionLabel,
    modalOpen,
  });
  applySiteFurinActionDom({
    button: siteFurinAction,
    presentation: safePresentation.siteAction,
    label: text?.siteActionLabel,
    modalOpen,
  });
  applyGlobalSentinelOutcomeStatusDom({
    status: globalSentinelStatus,
    text,
  });
  if (ritualGuide) {
    ritualGuide.hidden = !ritualGuideVisible;
    ritualGuide.setAttribute('aria-hidden', modalOpen || !ritualGuideVisible ? 'true' : 'false');
  }
  const explicitPhaseAnnouncement = applyRitualPhaseAnnouncementDom({
    ritualGuide,
    text,
    visible: !modalOpen && ritualGuideVisible,
  });
  for (const node of [ritualTitle, ritualBody, ritualHint]) {
    if (!node) continue;
    if (explicitPhaseAnnouncement) node.setAttribute('aria-hidden', 'true');
    else node.removeAttribute('aria-hidden');
  }
  if (ritualTitle) setText(ritualTitle, text?.title || '');
  if (ritualBody) setText(ritualBody, text?.body || '');
  if (ritualHint) setText(ritualHint, text?.hint || '');
  return {
    guideWakeProgress: Number(safePresentation.guideWakeProgress) || 0,
  };
}

export function applySiteFurinGuidanceDom({
  root = null,
  scene = null,
  progress = 0,
} = {}) {
  const value = Math.max(0, Math.min(1, Number(progress) || 0));
  if (root) {
    root.style.setProperty('--nudge-site-furin-guidance-progress', String(value));
  }
  if (scene) {
    toggleClass(scene, 'is-site-furin-guiding', value > 0 && value < 1);
  }
  return value;
}
