import MemoryPurgeReviewSurface from '../components/MemoryPurgeReviewSurface.jsx';
import {
  buildArtifactControlSurface,
  buildArtifactDockModel,
  buildArtifactBinaryControlRowModel,
  buildArtifactChoiceControlRowModel,
  buildArtifactMasterControl,
  buildArtifactRowsBlockModel,
  buildArtifactStatusBlockModel,
  buildArtifactWorkflowReviewModel,
  getArtifactFamilyChildren,
  getArtifactFamilyHandlerChildren,
  getArtifactFamilyHandlers,
  getArtifactFamilyState,
  resolveArtifactControlAccentColor,
  resolveArtifactChildConfiguredEnabled,
  resolveTranslationText,
  requireArtifactChildHandler,
} from './shared.jsx';

export function buildMemoryPurgeCard({ shell, t, state, handlers }) {
  const echoFamily = getArtifactFamilyState(state, 'echo');
  const echoHandlers = getArtifactFamilyHandlers(handlers, 'echo');
  const echoChildren = getArtifactFamilyChildren(state, 'echo');
  const echoHandlerChildren = getArtifactFamilyHandlerChildren(handlers, 'echo');
  const toggleHistoryCleanup = requireArtifactChildHandler(
    echoHandlerChildren,
    'echo',
    'historyCleanup',
    'toggleHistoryCleanup',
  );
  const toggleBookmarkConceal = requireArtifactChildHandler(
    echoHandlerChildren,
    'echo',
    'bookmarkConceal',
    'toggleBookmarkConceal',
  );
  const toggleTabEvaporation = requireArtifactChildHandler(
    echoHandlerChildren,
    'echo',
    'tabEvaporation',
    'toggle',
  );
  const setTabEvaporationTimeout = requireArtifactChildHandler(
    echoHandlerChildren,
    'echo',
    'tabEvaporation',
    'setValue',
  );

  const historyCleanupEnabled = resolveArtifactChildConfiguredEnabled(state, 'echo', 'historyCleanup');
  const bookmarkConcealEnabled = resolveArtifactChildConfiguredEnabled(state, 'echo', 'bookmarkConceal');
  const tabEvaporationEnabled = resolveArtifactChildConfiguredEnabled(state, 'echo', 'tabEvaporation');

  const tabEvaporationTimeout = Number(echoChildren.tabEvaporation?.value) || 5;

  const historyCleanupLabel = t('artifacts.memory_purge.history_label');
  const historyCleanupDescription = t('artifacts.memory_purge.history_desc');
  const bookmarkConcealLabel = t('artifacts.memory_purge.bookmark_label');
  const bookmarkConcealDescription = t('artifacts.memory_purge.bookmark_desc');
  const tabEvaporationLabel = resolveTranslationText(
    t,
    'artifacts.memory_purge.tab_evaporation_label',
    'Tab evaporation',
  );
  const tabEvaporationDescription = resolveTranslationText(
    t,
    'artifacts.memory_purge.tab_evaporation_desc',
    'Automatically close blocked tabs left idle in background.',
  );
  const tabEvaporationOptions = [3, 5, 10, 15].map((timeout) => ({
    value: timeout,
    label: resolveTranslationText(
      t,
      `artifacts.memory_purge.tab_evaporation_timeout_options.${timeout}`,
      `${timeout}m`,
    ),
    feedback: resolveTranslationText(
      t,
      `artifacts.memory_purge.tab_evaporation_timeout_feedback.${timeout}`,
      '',
    ),
  }));

  const echoWorkflowState = state.echoWorkflowState && typeof state.echoWorkflowState === 'object'
    ? state.echoWorkflowState
    : {};
  const memoryPurgeStatus = echoWorkflowState.status || null;
  const workflowReviewState = state.artifactWorkflowReviews?.echo || null;
  const workflowReviewHandlers = handlers.artifactWorkflowReviews?.echo || null;
  const accentColor = resolveArtifactControlAccentColor(state.themeId, shell.canonicalId);
  const rows = [
    buildArtifactBinaryControlRowModel({
      t,
      childKey: 'historyCleanup',
      label: historyCleanupLabel,
      description: historyCleanupDescription,
      enabled: historyCleanupEnabled,
      accentColor,
      onToggle: toggleHistoryCleanup,
      labelClassName: 'text-[11px] text-on-surface',
      descriptionClassName: 'font-semibold text-on-surface-muted',
    }),
    buildArtifactBinaryControlRowModel({
      t,
      childKey: 'bookmarkConceal',
      label: bookmarkConcealLabel,
      description: bookmarkConcealDescription,
      enabled: bookmarkConcealEnabled,
      accentColor,
      onToggle: toggleBookmarkConceal,
      labelClassName: 'text-[11px] text-on-surface',
      descriptionClassName: 'font-semibold text-on-surface-muted',
    }),
    buildArtifactChoiceControlRowModel({
      t,
      childKey: 'tabEvaporation',
      label: tabEvaporationLabel,
      description: tabEvaporationDescription,
      enabled: tabEvaporationEnabled,
      value: tabEvaporationTimeout,
      options: tabEvaporationOptions,
      accentColor,
      onToggle: toggleTabEvaporation,
      onValueChange: setTabEvaporationTimeout,
    }),
  ];

  return {
    workflowReview: workflowReviewState?.open === true
      ? buildArtifactWorkflowReviewModel({
        key: `memory-purge:${workflowReviewState.mode}`,
        content: (
          <MemoryPurgeReviewSurface
            themeId={state.themeId}
            accentColor={accentColor}
            mode={workflowReviewState.mode}
            preview={workflowReviewState.preview}
            requirePasscode={workflowReviewState.requirePasscode}
            passcodeInput={workflowReviewState.passcodeInput}
            backupState={workflowReviewState.backupState}
            onPasscodeInputChange={workflowReviewHandlers?.onPasscodeInputChange}
            onBackupBookmarks={workflowReviewHandlers?.onBackupBookmarks}
            onConfirm={workflowReviewHandlers?.onConfirm}
            onCancel={workflowReviewHandlers?.onCancel}
          />
        ),
      })
      : null,
    controlSurface: buildArtifactControlSurface({
      dock: buildArtifactDockModel({
        blocks: [
          buildArtifactRowsBlockModel({ rows }),
          buildArtifactStatusBlockModel({
            status: memoryPurgeStatus,
          }),
        ],
      }),
      master: buildArtifactMasterControl({
        t,
        familyState: echoFamily,
        familyHandlers: echoHandlers,
        shell,
        accentColor,
      }),
    }),
  };
}
