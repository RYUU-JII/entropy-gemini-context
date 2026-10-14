import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BUILD_INCLUDE_DEBUG_TOOLS } from '@/platform/build/releaseCapabilities.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useDocumentVisibility } from '@/ui-kit/hooks/useDocumentVisibility.js';
import { guidanceClient } from '@/apps/shared/guidance/guidanceClient.js';
import { GUIDANCE_STATE_CHANGED_EVENT } from '@/apps/shared/guidance/guidanceUiEvents.js';
import { useGuidanceStateChanges } from './useGuidanceStateChanges.js';
import { isVisibleGuidanceAnchor as isVisibleAnchor, observeGuidanceAnchorVisibility } from './guidanceAnchorVisibility.js';
import { useDashboardPresentationAdmission } from '../presentation/DashboardPresentationAdmission.jsx';

const GuidanceContext = createContext(null);
const DOCUMENT_ID = crypto.randomUUID();
const HOST_ID = `dashboard:${DOCUMENT_ID}`;
let documentAutomaticGuidePresented = false;
const documentDeferredGuideIds = new Set();

const isExpectedPreemption = failure => ['GUIDANCE_PROTECTION_PRESENTATION_BUSY',
  'GUIDANCE_CLAIM_STALE'].includes(failure.message);

export function useDashboardGuidance() { return useContext(GuidanceContext); }

export function useGuidanceAnchor({ guideId, copyKey, elementRef, enabled = true, onAction, actionKey,
  presentation = 'contextual' }) {
  const guidance = useDashboardGuidance();
  const actionRef = useRef(onAction);
  actionRef.current = onAction;
  useEffect(() => {
    if (!guidance || !enabled) return undefined;
    return guidance.registerAnchor({ guideId, copyKey, element: elementRef.current, presentation,
      onAction: onAction ? () => actionRef.current() : null, actionKey });
  }, [guidance?.registerAnchor, elementRef, guideId, copyKey, enabled, actionKey, Boolean(onAction), presentation]);
}

// Anchor presenters own their visible UI and acknowledge its actual painted frame.
// The provider still owns the claim, receipt ordering and document admission.
export function useGuidancePresenter(guideId) {
  const guidance = useDashboardGuidance();
  const item = guidance?.activePresentation;
  const claimId = item?.guideId === guideId && item.presentation === 'anchor' ? item.claim.claimId : null;
  const present = guidance?.markPresented;
  const dismiss = guidance?.dismissPresentation;
  const complete = guidance?.completePresentation;
  return React.useMemo(() => claimId === null ? null : {
    claimId,
    item,
    onPresented: () => present(claimId),
    onDismiss: () => dismiss(claimId),
    onComplete: () => complete(claimId),
  }, [claimId, item, present, dismiss, complete]);
}

// An in-place interaction may retain its own guide while stopping unrelated
// explanations from competing with the user's current work. This is transient
// document presentation state, never a second viewed/completed ledger.
export function useGuidanceInteraction({ id, active, retainedGuideId = null }) {
  const guidance = useDashboardGuidance();
  useEffect(() => {
    if (!guidance || !active) return undefined;
    return guidance.registerInteraction({ id, retainedGuideId });
  }, [guidance?.registerInteraction, id, active, retainedGuideId]);
}

export function GuidanceAnchor({ guideId, copyKey, enabled = true, onAction, actionKey,
  presentation = 'contextual', children, className = '', ...rest }) {
  const guidance = useDashboardGuidance();
  const ref = useRef(null);
  const actionRef = useRef(onAction);
  actionRef.current = onAction;
  useEffect(() => {
    if (!guidance || !enabled) return undefined;
    return guidance.registerAnchor({ guideId, copyKey, element: ref.current, presentation,
      onAction: onAction ? () => actionRef.current() : null, actionKey });
  }, [guidance?.registerAnchor, guideId, copyKey, enabled, actionKey, Boolean(onAction), presentation]);
  return <div {...rest} ref={ref} className={className} data-guidance-anchor={guideId}>{children}</div>;
}

export function GuidanceHelpButton({ copyKey }) {
  const { t } = useAppTranslation('guidance');
  return <details className="text-xs text-on-surface-muted">
    <summary className="cursor-pointer text-[11px] underline underline-offset-4">{t('common.help')}</summary>
    <p className="mt-2 max-w-prose leading-relaxed">{t(copyKey)}</p>
  </details>;
}

export function GuidanceSupport() {
  const guidance = useDashboardGuidance();
  const { t } = useAppTranslation('guidance');
  if (!guidance?.error) return null;
  return <p role="alert" className="mt-2 text-xs leading-relaxed text-warning">
    {t('common.failed', { message: guidance.error.message })}
    <button type="button" onClick={guidance.retry} className="ml-2 underline">{t('common.retry')}</button>
  </p>;
}

export default function DashboardGuidanceProvider({ children, blocked, activeTabId, onTabChange }) {
  const visible = useDocumentVisibility();
  const { contextualPresentationAllowed } = useDashboardPresentationAdmission();
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);
  const [anchorsRevision, setAnchorsRevision] = useState(0);
  const [anchorVisibilityRevision, setAnchorVisibilityRevision] = useState(0);
  const [interactionsRevision, setInteractionsRevision] = useState(0);
  const anchors = useRef(new Map());
  const interactions = useRef(new Map());
  const activeRef = useRef(null);
  const claimPendingRef = useRef(false);
  const aliveRef = useRef(true);
  const readSequenceRef = useRef(0);
  const readFailuresRef = useRef(new WeakMap());
  const reportError = useCallback((failure) => {
    if (!aliveRef.current) return;
    const readSequence = failure instanceof Error ? readFailuresRef.current.get(failure) : undefined;
    if (readSequence !== undefined && readSequence !== readSequenceRef.current) return;
    setError(failure);
  }, []);
  const admissionRef = useRef(false);
  admissionRef.current = visible && !blocked && contextualPresentationAllowed;
  const tabRef = useRef(activeTabId);
  const currentTabRef = useRef(activeTabId);
  currentTabRef.current = activeTabId;
  const registerAnchor = useCallback((anchor) => {
    if (!['contextual', 'anchor'].includes(anchor.presentation)) throw new Error('GUIDANCE_ANCHOR_PRESENTATION_INVALID');
    anchors.current.set(anchor.guideId, anchor);
    setAnchorsRevision((revision) => revision + 1);
    return () => {
      if (anchors.current.get(anchor.guideId) === anchor) anchors.current.delete(anchor.guideId);
      setAnchorsRevision((revision) => revision + 1);
    };
  }, []);
  const registerInteraction = useCallback((interaction) => {
    if (typeof interaction.id !== 'string' || !interaction.id) throw new Error('GUIDANCE_INTERACTION_ID_REQUIRED');
    interactions.current.set(interaction.id, interaction);
    setInteractionsRevision((revision) => revision + 1);
    return () => {
      if (interactions.current.get(interaction.id) === interaction) interactions.current.delete(interaction.id);
      setInteractionsRevision((revision) => revision + 1);
    };
  }, []);
  useEffect(() => {
    if (!visible || blocked) return undefined;
    const elements = [...anchors.current.values()]
      .filter(anchor => anchor.presentation === 'anchor' && anchor.element?.isConnected)
      .map(anchor => anchor.element);
    if (elements.length === 0) return undefined;
    return observeGuidanceAnchorVisibility(elements, () => setAnchorVisibilityRevision(revision => revision + 1));
  }, [anchorsRevision, visible, blocked]);
  const admitsInteraction = useCallback((guideId) => [...interactions.current.values()]
    .every((interaction) => interaction.retainedGuideId === guideId), []);
  const refresh = useCallback(async () => {
    const readSequence = ++readSequenceRef.current;
    try {
      const result = await guidanceClient.readState({ surface: 'dashboard' });
      if (aliveRef.current && readSequence === readSequenceRef.current) { setState(result); setError(null); }
      return result;
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      readFailuresRef.current.set(failure, readSequence);
      throw failure;
    }
  }, []);
  useGuidanceStateChanges(refresh, reportError);
  const releaseActive = useCallback(async () => {
    const item = activeRef.current;
    activeRef.current = null;
    setActive(null);
    if (!item?.claim) return;
    item.settled = true;
    claimPendingRef.current = true;
    try {
      if (item.presentedRequest) await item.presentedRequest.catch((failure) => {
        if (!isExpectedPreemption(failure)) reportError(failure);
      });
      await guidanceClient.release({ claimId: item.claim.claimId });
      await refresh();
    } finally { claimPendingRef.current = false; }
    // A scroll re-entry can precede the release ACK. Reevaluate only after the
    // old lease has ended and its canonical receipt state has been read.
    if (aliveRef.current) setAnchorVisibilityRevision(revision => revision + 1);
  }, [refresh, reportError]);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      readSequenceRef.current += 1;
      if (activeRef.current?.claim) void guidanceClient.release({ claimId: activeRef.current.claim.claimId })
        .catch((failure) => console.error('Guidance claim release failed.', failure));
    };
  }, []);
  useEffect(() => {
    const changed = () => { void refresh().catch(reportError); };
    if (visible && !blocked) changed();
    window.addEventListener(GUIDANCE_STATE_CHANGED_EVENT, changed);
    return () => window.removeEventListener(GUIDANCE_STATE_CHANGED_EVENT, changed);
  }, [visible, blocked, refresh, activeTabId, reportError]);
  useEffect(() => {
    if (visible && !blocked && contextualPresentationAllowed) return;
    void releaseActive().catch(reportError);
  }, [visible, blocked, contextualPresentationAllowed, releaseActive, reportError]);
  useEffect(() => {
    const item = activeRef.current;
    if (item && !admitsInteraction(item.guideId)) void releaseActive().catch(reportError);
  }, [interactionsRevision, admitsInteraction, releaseActive, reportError]);
  useEffect(() => {
    const item = activeRef.current;
    const retained = item && [...interactions.current.values()].some((interaction) => interaction.retainedGuideId === item.guideId);
    if (item && !retained && (anchors.current.get(item.guideId)?.element !== item.element || !isVisibleAnchor(item.element))) {
      void releaseActive().catch(reportError);
    }
  }, [anchorsRevision, anchorVisibilityRevision, interactionsRevision, releaseActive, reportError]);
  useEffect(() => {
    if (state?.installationAdmissionBlocked && activeRef.current?.installation) {
      void releaseActive().catch(reportError);
    }
  }, [state?.installationAdmissionBlocked, releaseActive, reportError]);
  useEffect(() => {
    if (tabRef.current !== activeTabId) {
      tabRef.current = activeTabId;
      void releaseActive().catch(reportError);
    }
  }, [activeTabId, releaseActive, reportError]);

  const present = useCallback(async (item, replay = false) => {
    if (!visible || blocked || !contextualPresentationAllowed || activeRef.current || claimPendingRef.current || !admitsInteraction(item.guideId)
      || item.presentation !== 'anchor' || !isVisibleAnchor(item.element)) return false;
    claimPendingRef.current = true;
    const requestedTabId = currentTabRef.current;
    try {
      const claim = await guidanceClient.claim({ guideId: item.guideId, revision: 1,
        hostId: HOST_ID, documentId: DOCUMENT_ID, visible: true, replay,
        ...(item.journeyDay ? { journeyDay: item.journeyDay } : {}) });
      if (!claim) return false;
      if (!aliveRef.current || !admissionRef.current || document.hidden || requestedTabId !== currentTabRef.current
        || !admitsInteraction(item.guideId) || !isVisibleAnchor(item.element)) {
        await guidanceClient.release({ claimId: claim.claimId });
        return false;
      }
      if (item.installation && (!Number.isInteger(claim.installationGoalMinutes) || claim.installationGoalMinutes <= 0)) {
        await guidanceClient.release({ claimId: claim.claimId });
        throw new Error('GUIDANCE_INSTALLATION_CLAIM_GOAL_INVALID');
      }
      const presentation = { ...item,
        ...(item.installation ? { installation: { ...item.installation, globalGoalMinutes: claim.installationGoalMinutes } } : {}),
        claim, replay, presented: false, presentedRequest: null, settled: false };
      activeRef.current = presentation;
      setActive(presentation);
      return true;
    } catch (failure) {
      if (!['GUIDANCE_PRESENTATION_BUSY', 'GUIDANCE_PROTECTION_PRESENTATION_BUSY'].includes(failure.message)) reportError(failure);
      return false;
    }
    finally { claimPendingRef.current = false; }
  }, [blocked, visible, contextualPresentationAllowed, admitsInteraction, reportError]);
  useEffect(() => {
    if (!state || !visible || blocked || !contextualPresentationAllowed || active || claimPendingRef.current || interactions.current.size > 0) return;
    const installationAnchor = anchors.current.get('flare.first_installation');
    if (state.pendingInstallation && installationAnchor && isVisibleAnchor(installationAnchor.element)
      && !documentDeferredGuideIds.has('flare.first_installation')) {
      void present({ ...installationAnchor, installation: state.pendingInstallation });
      return;
    }
    const journeyAnchor = anchors.current.get('journey.stage_change');
    if (state.stageChange && activeTabId === 'main' && journeyAnchor && isVisibleAnchor(journeyAnchor.element)
      && !documentDeferredGuideIds.has('journey.stage_change')) {
      void present({ ...journeyAnchor, journeyDay: state.stageChange.day });
      return;
    }
    if (documentAutomaticGuidePresented) return;
    const candidate = anchors.current.get('garden.first_site');
    if (candidate?.presentation === 'anchor' && isVisibleAnchor(candidate.element)
      && !state.receipts[candidate.guideId]?.presentedAtMs && !documentDeferredGuideIds.has(candidate.guideId)) {
      void present(candidate);
    }
  }, [state, visible, blocked, contextualPresentationAllowed, active, anchorsRevision, anchorVisibilityRevision, interactionsRevision, activeTabId, present]);
  useEffect(() => {
    if (!active || !visible || blocked) return undefined;
    let renewing = false;
    const timer = setInterval(() => {
      if (renewing || activeRef.current !== active || active.settled) return;
      if (!isVisibleAnchor(active.element)) { void releaseActive().catch(reportError); return; }
      renewing = true;
      void guidanceClient.renew({ claimId: active.claim.claimId }).catch((failure) => {
        if (activeRef.current !== active || active.settled) return;
        if (!isExpectedPreemption(failure)) reportError(failure);
        void releaseActive().catch(reportError);
      }).finally(() => { renewing = false; });
    }, active.installation ? 1000 : 10_000);
    return () => clearInterval(timer);
  }, [active, visible, blocked, releaseActive, reportError]);
  const markPresented = useCallback((expectedClaimId) => {
    const item = activeRef.current;
    if (!item || item.settled || item.presentedRequest || !admissionRef.current || document.hidden
      || !isVisibleAnchor(item.element)) return;
    if (expectedClaimId !== undefined && item.claim.claimId !== expectedClaimId) return;
    if (!item.replay && !item.installation) documentAutomaticGuidePresented = true;
    item.presentedRequest = guidanceClient.markPresented({ claimId: item.claim.claimId }).then((result) => {
      item.presented = true;
      return result;
    });
    void item.presentedRequest.then(() => {
      if (activeRef.current === item && !item.settled) return refresh();
    }).catch((failure) => { if (!isExpectedPreemption(failure)) reportError(failure); });
  }, [refresh, reportError]);
  const settle = useCallback(async (kind, expectedClaimId) => {
    const item = activeRef.current;
    if (!item || item.settled) return;
    if (expectedClaimId !== undefined && item.claim.claimId !== expectedClaimId) return;
    const settlementStarted = BUILD_INCLUDE_DEBUG_TOOLS ? performance.now() : null;
    item.settled = true;
    documentDeferredGuideIds.add(item.guideId);
    claimPendingRef.current = true;
    activeRef.current = null;
    setActive(null);
    try {
      // Closing before first paint is a release, not a fabricated viewing receipt.
      if (item.presentedRequest) await item.presentedRequest;
      if (item.presented || item.replay) await guidanceClient[kind]({ claimId: item.claim.claimId });
      else await guidanceClient.release({ claimId: item.claim.claimId });
    } catch (failure) {
      await guidanceClient.release({ claimId: item.claim.claimId });
      if (!isExpectedPreemption(failure)) throw failure;
    } finally {
      claimPendingRef.current = false;
      await refresh();
      if (BUILD_INCLUDE_DEBUG_TOOLS) console.debug('[SETTINGS_FLOW][timing]', JSON.stringify({
        phase: 'guidance_settlement', kind, guideId: item.guideId,
        durationMs: performance.now() - settlementStarted,
      }));
    }
  }, [refresh]);
  const dismiss = useCallback((expectedClaimId) => settle('dismiss', expectedClaimId).catch(reportError), [settle, reportError]);
  const complete = useCallback((expectedClaimId) => settle('complete', expectedClaimId).catch(reportError), [settle, reportError]);
  const requestGuide = useCallback((item) => { void present(item, true); }, [present]);
  const replayInstallation = useCallback(() => {
    const anchor = anchors.current.get('flare.first_installation');
    if (state?.installationReplay && anchor) void present({ ...anchor, installation: state.installationReplay }, true);
  }, [state, present]);
  const retry = useCallback(() => { void refresh().catch(reportError); }, [refresh, reportError]);
  const value = React.useMemo(() => ({ state, error, retry, activeTabId, navigate: onTabChange,
    registerAnchor, registerInteraction, requestGuide, replayInstallation,
    refresh, activePresentation: active, markPresented, dismissPresentation: dismiss, completePresentation: complete }),
    [state, error, retry, activeTabId, onTabChange, registerAnchor, registerInteraction, requestGuide, replayInstallation,
      refresh, active, markPresented, dismiss, complete]);
  return <GuidanceContext.Provider value={value}>{children}</GuidanceContext.Provider>;
}
