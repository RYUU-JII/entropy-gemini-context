import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useScheduleRuntimeState } from '../../hooks/useScheduleRuntimeState.js';
import { ensureNotificationsPermissionStrict } from '../../../../platform/security/capabilityGate.js';
import { useScheduleController } from './useScheduleController.js';
import { useRuntimeParkedStoreSlice } from '../../hooks/useRuntimeParkedStoreSlice.js';
import { useAnalysisStore } from '../../stores/useAnalysisStore.js';
import { useProtocolStore } from '../../stores/useProtocolStore.js';
import { useThemeId } from '../../stores/usePreferenceStore.js';
import { useDashboardTabReadiness } from '../../loading/useDashboardTabReadiness.js';
import DashboardActionAsyncBoundary from '../../loading/DashboardActionAsyncBoundary.jsx';
import { withDynamicImportRecovery } from '@/platform/extension/dynamicImportRecovery.js';
import {
    DashboardTabErrorSurface,
    DashboardTabLoadingSurface,
    DashboardTabRetryAction,
} from '../../loading/DashboardTabStateSurfaces.jsx';
import {
    SCHEDULE_RECIPE_VARIANTS,
    getScheduleVisualPolicy,
    resolveScheduleRecipeVariant,
} from '../../../../themes/core/scheduleVisualPolicy.js';
import {
    getInteractionMotionStyle,
} from '@/themes/core/motion/index.js';
import { useAppTranslation } from '../../../../ui-kit/hooks/useAppTranslation.js';
import ScheduleRhythmWorkspace from './components/ScheduleRhythmWorkspace.jsx';
import { GuidanceAnchor } from '@/apps/dashboard/guidance/DashboardGuidanceProvider.jsx';
import { SCHEDULE_SPECIAL_SESSION_PANEL_ID } from './components/scheduleSpecialSessionContract.js';
import {
    DASHBOARD_TAB_ASYNC_BOUNDARY_IDS,
    isDashboardTabAsyncBoundaryAllowed,
} from '../loadingPolicy.js';
import {
    DEFAULT_NOTIFICATIONS_CONFIG,
    normalizeNotificationsConfig,
} from '../../../../domains/settings/config/notificationsConfig.js';
import {
    normalizeScheduleNotificationRouteIntent,
} from '../../../../domains/notifications/advisory/scheduleNotificationAdvisory.js';
import './scheduleWorkspace.css';

const SPECIAL_SESSION_ASYNC_BOUNDARY_ID = DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SCHEDULE_SPECIAL_SESSION;
if (!isDashboardTabAsyncBoundaryAllowed('schedule', SPECIAL_SESSION_ASYNC_BOUNDARY_ID)) {
    throw new Error(`DASHBOARD_TAB_ASYNC_BOUNDARY_UNDECLARED:schedule:${SPECIAL_SESSION_ASYNC_BOUNDARY_ID}`);
}
const loadScheduleSpecialSessionWorkspace = withDynamicImportRecovery(
    () => import('./components/ScheduleSpecialSessionWorkspace.jsx'),
    { boundaryId: 'dashboard-schedule-special-session' },
);

const buildLocalizedDayLabels = (t) => ([
    t('days.sun'),
    t('days.mon'),
    t('days.tue'),
    t('days.wed'),
    t('days.thu'),
    t('days.fri'),
    t('days.sat'),
]);

const DEFAULT_RESET_HOUR = 4;
const SCHEDULE_STABLE_INTERACTION_STYLE = getInteractionMotionStyle('stable');
const selectScheduleProtocolSlice = (state) => ({
    notificationsConfig: state.notificationsConfig,
    allowedUrls: state.allowedUrls,
});
const selectScheduleAnalysisSlice = (state) => ({
    resetHour: resolveResetHour(state.cycleState),
});

function requireScheduleRouteCopy(tab) {
    const navLabel = typeof tab?.navLabel === 'string' ? tab.navLabel.trim() : '';
    const title = typeof tab?.title === 'string' ? tab.title.trim() : '';
    const description = typeof tab?.description === 'string' ? tab.description.trim() : '';
    if (!navLabel || !title || !description) {
        throw new Error('SCHEDULE_ROUTE_COPY_REQUIRED');
    }
    return Object.freeze({ description, navLabel, title });
}

function resolveResetHour(cycleState) {
    const fromPolicy = Number(cycleState?.resetPolicy?.effectiveResetHour);
    if (Number.isFinite(fromPolicy)) {
        return Math.min(23, Math.max(0, Math.floor(fromPolicy)));
    }
    return DEFAULT_RESET_HOUR;
}

function isEditableKeyboardTarget(target) {
    if (!target || typeof target !== 'object') return false;
    const tagName = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
    return target.isContentEditable === true
        || tagName === 'input'
        || tagName === 'textarea'
        || tagName === 'select';
}

function isScheduleInteractionTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest([
        '[data-schedule-editor]',
        '[data-schedule-track]',
        '[data-schedule-days]',
        '[data-schedule-utility]',
        '[data-special-session-panel]',
    ].join(','));
}

function focusScheduleBlock(blockId) {
    if (!blockId || typeof document === 'undefined') return;
    requestAnimationFrame(() => {
        const target = Array.from(document.querySelectorAll('[data-schedule-block-id]'))
            .find((element) => element.dataset.scheduleBlockId === blockId && element.getAttribute('aria-hidden') !== 'true');
        target?.focus();
    });
}

function focusScheduleAddWindow() {
    if (typeof document === 'undefined') return;
    requestAnimationFrame(() => document.querySelector('[data-schedule-add-window]')?.focus());
}

function resolveAdjacentVisibleScheduleBlockId(blockId) {
    if (!blockId || typeof document === 'undefined') return null;
    const blockIds = Array.from(document.querySelectorAll('[data-schedule-block-id]'))
        .filter((element) => element.getAttribute('aria-hidden') !== 'true')
        .map((element) => element.dataset.scheduleBlockId)
        .filter(Boolean);
    const selectedIndex = blockIds.indexOf(blockId);
    if (selectedIndex < 0) return null;
    return blockIds[selectedIndex + 1] || blockIds[selectedIndex - 1] || null;
}

function ScheduleHeaderStatus({
    className = '',
    label,
    detail,
    labelColor,
    tokens,
    typography,
}) {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`shrink-0 border-l pl-4 text-right ${className}`}
            style={{ borderColor: `color-mix(in srgb, ${tokens.stageEdge} 44%, transparent)` }}
        >
            <p className="text-[10px] font-semibold tracking-[0.12em]" style={{ color: labelColor }}>
                {label}
            </p>
            <p
                className="mt-1 min-h-4 text-[10px] font-medium tabular-nums"
                style={{ color: tokens.inkMuted, fontFamily: typography.time }}
            >
                {detail}
            </p>
        </div>
    );
}

function ScheduleSpecialSessionAsyncSurface({
    children,
    role = 'status',
}) {
    return (
        <section
            id={SCHEDULE_SPECIAL_SESSION_PANEL_ID}
            role={role}
            data-special-session-panel
            className="min-w-0 py-5 text-sm"
        >
            {children}
        </section>
    );
}

function ScheduleTabReadyContent({ isRuntimeActive, params, tab, t, themeId, onTabChange }) {
    const {
        notificationsConfig,
        allowedUrls,
    } = useRuntimeParkedStoreSlice(
        useProtocolStore,
        selectScheduleProtocolSlice,
        isRuntimeActive,
    );
    const scheduleVisualPolicy = useMemo(
        () => getScheduleVisualPolicy(themeId),
        [themeId]
    );
    const { activeSchedule, selectedBlockId, canUndo, handlers } = useScheduleController(isRuntimeActive);
    const runtime = useScheduleRuntimeState(isRuntimeActive);
    const { resetHour } = useRuntimeParkedStoreSlice(
        useAnalysisStore,
        selectScheduleAnalysisSlice,
        isRuntimeActive,
    );

    const [nowTs, setNowTs] = useState(() => Date.now());
    const [isSpecialSessionPanelOpen, setIsSpecialSessionPanelOpen] = useState(false);
    const workbenchActionsRef = useRef(null);

    useEffect(() => {
        if (!isRuntimeActive) return undefined;
        const timer = setInterval(() => setNowTs(Date.now()), 30 * 1000);
        return () => clearInterval(timer);
    }, [isRuntimeActive]);

    useEffect(() => {
        if (!isRuntimeActive) return undefined;
        const handleKeyDown = (event) => {
            if (event.defaultPrevented || isEditableKeyboardTarget(event.target)) return;
            if (!activeSchedule?.blocks?.length) return;
            if (event.key === 'Escape' && selectedBlockId) {
                event.preventDefault();
                handlers.onClearSelection();
                focusScheduleBlock(selectedBlockId);
                return;
            }
            if ((event.key === 'Delete' || event.key === 'Backspace') && selectedBlockId) {
                const focusedBlockId = event.target?.closest?.('[data-schedule-block-id]')?.dataset?.scheduleBlockId;
                if (focusedBlockId !== selectedBlockId) return;
                event.preventDefault();
                const nextFocusId = resolveAdjacentVisibleScheduleBlockId(selectedBlockId);
                handlers.onRemoveBlock(selectedBlockId);
                if (nextFocusId) focusScheduleBlock(nextFocusId);
                else focusScheduleAddWindow();
                return;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isRuntimeActive, selectedBlockId, handlers, activeSchedule?.blocks]);

    useEffect(() => {
        if (!isRuntimeActive) setIsSpecialSessionPanelOpen(false);
    }, [isRuntimeActive]);

    const {
        recipes,
        typography,
        tokens,
        timeline: timelinePolicy,
    } = scheduleVisualPolicy;
    const usesEdgeToEdgeShell = resolveScheduleRecipeVariant('shell', recipes.shell, {
        [SCHEDULE_RECIPE_VARIANTS.shell.EDGE_TO_EDGE]: () => true,
        [SCHEDULE_RECIPE_VARIANTS.shell.FRAMED]: () => false,
    });
    const headingVariant = resolveScheduleRecipeVariant('heading', recipes.heading, {
        [SCHEDULE_RECIPE_VARIANTS.heading.PAGE_HEADER]: () => 'page_header',
        [SCHEDULE_RECIPE_VARIANTS.heading.SIDEBAR_OWNED]: () => 'sidebar_owned',
        [SCHEDULE_RECIPE_VARIANTS.heading.IDENTITY_AXIS]: () => 'identity_axis',
    });
    const usesSidebarOwnedHeading = headingVariant === 'sidebar_owned';
    const usesIdentityAxisHeading = headingVariant === 'identity_axis';
    const statusPlacement = resolveScheduleRecipeVariant('status', recipes.status, {
        [SCHEDULE_RECIPE_VARIANTS.status.PAGE_HEADER]: () => 'page',
        [SCHEDULE_RECIPE_VARIANTS.status.STAGE_META]: () => 'stage',
    });
    const placesStatusInPageHeader = statusPlacement === 'page';
    const placesStatusInStage = statusPlacement === 'stage';
    const routeCopy = requireScheduleRouteCopy(tab);
    const resolvedNotificationsConfig = useMemo(
        () => normalizeNotificationsConfig(notificationsConfig, { defaults: DEFAULT_NOTIFICATIONS_CONFIG }),
        [notificationsConfig]
    );

    const appliedMode = runtime.error ? null : runtime.state?.mode;
    const headerStateLabel = !appliedMode
        ? t(runtime.error ? 'status.unavailable' : 'status.loading')
        : t(appliedMode === 'isolation' ? 'modes.isolation_active'
            : appliedMode === 'relaxation' ? 'header.state_relaxing' : 'header.state_protected');
    const headerStateColor = runtime.error ? tokens.danger
        : appliedMode === 'isolation' ? tokens.isolationInk
            : appliedMode === 'relaxation' ? tokens.relaxationInk : tokens.inkMuted;
    const statusDetail = !appliedMode ? '' : runtime.state.endsAt
        ? `${t('special_session.ends_at', { time: new Date(runtime.state.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })} · ${t('status.remaining', { minutes: Math.max(0, Math.ceil((runtime.state.endsAt - nowTs) / 60_000)) })}`
        : runtime.state.capExceeded ? t('status.cap_reinforced') : '';
    const dayLabels = useMemo(() => buildLocalizedDayLabels(t), [t]);
    const routeNotificationIntent = normalizeScheduleNotificationRouteIntent(params?.intent);

    const handleCanvasClick = (event) => {
        if (!selectedBlockId) return;
        if (isScheduleInteractionTarget(event.target)) return;
        handlers.onClearSelection();
    };

    const handleToggleSpecialSession = useCallback(() => {
        if (workbenchActionsRef.current?.commit() === false) return;
        setIsSpecialSessionPanelOpen(true);
    }, []);
    const handleCloseSpecialSession = useCallback(() => {
        setIsSpecialSessionPanelOpen(false);
    }, []);

    const currentStatus = {
        label: headerStateLabel, detail: statusDetail, color: headerStateColor,
        actions: (
            <span className="inline-flex items-center gap-2" data-schedule-utility>
                {appliedMode === 'isolation' ? (
                    <button type="button" className="schedule-current-action" disabled={runtime.busy}
                        onClick={runtime.end}>{t(runtime.state.source === 'schedule' ? 'modes.end_occurrence' : 'special_session.end')}</button>
                ) : (
                    <button type="button" className="schedule-current-action" disabled={!appliedMode}
                        onClick={handleToggleSpecialSession}
                        aria-expanded={isSpecialSessionPanelOpen}
                        aria-controls={SCHEDULE_SPECIAL_SESSION_PANEL_ID}>{t('modes.start_now')}</button>
                )}
                {runtime.error ? <button type="button" className="schedule-current-action"
                    onClick={() => { void runtime.refresh().catch((error) => {
                        console.error('[Schedule] Runtime refresh failed:', error);
                    }); }}>{t('special_session.retry')}</button> : null}
            </span>
        ),
    };

    const notificationControl = useMemo(() => ({
        inheritedStart: resolvedNotificationsConfig.enabled && resolvedNotificationsConfig.sessionStart.enabled,
        inheritedEnd: resolvedNotificationsConfig.enabled && resolvedNotificationsConfig.sessionEnd.enabled,
        openOnEntry: routeNotificationIntent === 'notifications',
        ensurePermission: ensureNotificationsPermissionStrict,
    }), [
        resolvedNotificationsConfig,
        routeNotificationIntent,
    ]);

    const specialSessionPanel = isSpecialSessionPanelOpen ? (
        <DashboardActionAsyncBoundary
            boundaryId={SPECIAL_SESSION_ASYNC_BOUNDARY_ID}
            loadAction={loadScheduleSpecialSessionWorkspace}
            loadingFallback={(
                <ScheduleSpecialSessionAsyncSurface>
                    <span className="text-on-surface-muted">{t('common:status.loading')}</span>
                </ScheduleSpecialSessionAsyncSurface>
            )}
            renderError={(error, { retry }) => (
                <ScheduleSpecialSessionAsyncSurface
                    role="alert"
                >
                    <p className="text-danger">{t('special_session.error')}: {error?.message || String(error)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="border border-danger/30 px-3 py-1.5 text-xs font-bold text-danger"
                            onClick={retry}
                        >
                            {t('special_session.retry')}
                        </button>
                        <button
                            type="button"
                            className="border border-danger/30 px-3 py-1.5 text-xs font-bold text-danger"
                            onClick={handleCloseSpecialSession}
                        >
                            {t('special_session.close')}
                        </button>
                    </div>
                </ScheduleSpecialSessionAsyncSurface>
            )}
            renderAction={(LazyScheduleSpecialSessionWorkspace) => (
              <LazyScheduleSpecialSessionWorkspace
                visualTokens={tokens}
                typography={typography}
                t={t}
              />
            )}
        />
    ) : null;

    return (
        <div
            onClick={handleCanvasClick}
            data-schedule-tab
            data-schedule-applied-mode={runtime.error ? 'error' : appliedMode || 'pending'}
            data-schedule-shell={recipes.shell}
            data-schedule-heading={recipes.heading}
            className={`relative flex h-full min-h-0 w-full select-none flex-col overflow-hidden ${usesEdgeToEdgeShell ? 'p-0' : 'px-5 pb-5 pt-5 md:px-8 md:pb-6'}`}
            style={{
                ...SCHEDULE_STABLE_INTERACTION_STYLE,
                '--focus-marker': tokens.focusMarker,
                '--stage-depth': tokens.stageDepth,
                '--stage-highlight': tokens.stageHighlight,
                background: tokens.pageBackground,
                color: tokens.inkPrimary,
                fontFamily: typography.body,
            }}
        >
            <div className={`relative z-10 flex h-full min-h-0 w-full flex-col ${usesEdgeToEdgeShell ? 'max-w-none' : 'mx-auto max-w-5xl'}`}>
                {usesIdentityAxisHeading ? (
                    <header
                        data-schedule-identity-header="true"
                        className="relative flex h-[5.5rem] min-w-0 shrink-0 items-center px-6 text-left"
                    >
                        <h1
                            className="shrink-0 text-[clamp(1.55rem,2.6vw,2rem)] font-light leading-none tracking-tight font-heading"
                            style={{ color: tokens.inkPrimary, fontFamily: typography.title }}
                        >
                            {t('header.title_zen')}
                        </h1>
                        <span
                            aria-hidden="true"
                            className="ml-5 h-px w-12 shrink-0"
                            style={{
                                background: `linear-gradient(90deg, color-mix(in srgb, ${tokens.stageRidge} 56%, transparent), transparent)`,
                            }}
                        />
                    </header>
                ) : usesSidebarOwnedHeading ? (
                    <>
                        <h1 className="sr-only">{routeCopy.title}</h1>
                        <div
                            aria-hidden="true"
                            data-schedule-context-mark
                            style={{ color: tokens.inkMuted, fontFamily: typography.label }}
                        >
                            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.18em]">
                                {routeCopy.navLabel}
                            </span>
                            <span
                                className="h-px w-8 shrink-0"
                                style={{ backgroundColor: `color-mix(in srgb, ${tokens.stageEdge} 64%, transparent)` }}
                            />
                        </div>
                        {placesStatusInPageHeader ? (
                            <div className="flex shrink-0 justify-end px-6 pt-4">
                                <ScheduleHeaderStatus
                                    label={headerStateLabel}
                                    detail={statusDetail}
                                    labelColor={headerStateColor}
                                    tokens={tokens}
                                    typography={typography}
                                />
                            </div>
                        ) : null}
                    </>
                ) : (
                    <header className="relative flex shrink-0 items-start justify-between gap-8 px-6 pb-5 pt-6">
                        <div className="min-w-0 flex-1">
                            <p
                                className="text-[9px] font-semibold tracking-[0.22em] opacity-58"
                                style={{
                                    color: tokens.inkMuted,
                                    fontFamily: typography.label,
                                }}
                            >
                                {t('header.badge')}
                            </p>
                            <h1
                                className="mt-1 truncate text-[clamp(1.6rem,3vw,2.5rem)] font-semibold leading-none"
                                style={{
                                    color: tokens.inkPrimary,
                                    fontFamily: typography.title,
                                    letterSpacing: typography.titleLetterSpacing,
                                }}
                            >
                                {routeCopy.title}
                            </h1>
                            <p className="mt-2 text-[11px] font-medium" style={{ color: tokens.inkMuted }}>
                                {routeCopy.description}
                            </p>
                        </div>
                        {placesStatusInPageHeader ? (
                            <ScheduleHeaderStatus
                                className="mt-4"
                                label={headerStateLabel}
                                detail={statusDetail}
                                labelColor={headerStateColor}
                                tokens={tokens}
                                typography={typography}
                            />
                        ) : null}
                    </header>
                )}

                <GuidanceAnchor guideId="schedule.first_setup" copyKey="guides.schedule_first_setup"
                    enabled={isRuntimeActive && Boolean(selectedBlockId)} className="flex min-h-0 flex-1 flex-col">
                <ScheduleRhythmWorkspace
                    activeSchedule={activeSchedule}
                    selectedBlockId={selectedBlockId}
                    canUndo={canUndo}
                    handlers={handlers}
                    visualTokens={tokens}
                    typography={typography}
                    recipes={recipes}
                    timelinePolicy={timelinePolicy}
                    nowTs={nowTs}
                    resetHour={resetHour}
                    dayLabels={dayLabels}
                    allowedUrls={allowedUrls}
                    currentStatus={currentStatus}
                    notificationControl={notificationControl}
                    onManageSites={typeof onTabChange === 'function' ? () => onTabChange('sites') : null}
                    workbenchMode={isSpecialSessionPanelOpen ? 'instant' : 'recurring'}
                    onWorkbenchModeChange={(mode) => setIsSpecialSessionPanelOpen(mode === 'instant')}
                    workbenchActionsRef={workbenchActionsRef}
                    specialSessionWorkbench={specialSessionPanel}
                    t={t}
                />
                </GuidanceAnchor>

            </div>
        </div>
    );
}

export default function ScheduleTab({
    isActive,
    isPresented = isActive,
    isRuntimeActive = isActive,
    params = null,
    tab = null,
    onTabChange,
}) {
    const { t } = useAppTranslation('schedule');
    const themeId = useThemeId();
    const scheduleTabReadiness = useDashboardTabReadiness({
        tabId: 'schedule',
        themeId,
        isActive: isRuntimeActive,
    });

    if (!isPresented) return null;

    if (scheduleTabReadiness.phase === 'loading') {
        return (
            <DashboardTabLoadingSurface
                tabId="schedule"
                label={t('common:status.loading')}
            />
        );
    }

    if (scheduleTabReadiness.phase === 'error') {
        return (
            <DashboardTabErrorSurface
                tabId="schedule"
                title={t('common:status.error')}
                detail={scheduleTabReadiness.error?.message}
                actions={scheduleTabReadiness.retry ? (
                    <DashboardTabRetryAction
                        label={t('special_session.retry')}
                        onRetry={scheduleTabReadiness.retry}
                    />
                ) : null}
            />
        );
    }

    return (
        <ScheduleTabReadyContent
            isRuntimeActive={isRuntimeActive}
            params={params}
            tab={tab}
            t={t}
            themeId={themeId}
            onTabChange={onTabChange}
        />
    );
}
