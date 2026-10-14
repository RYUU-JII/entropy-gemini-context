import {
  buildScenarioSettings,
  collectScenarioHostPermissions,
  createIsolatedScenarioSettings,
  deepFreezeScenarioValue,
  defineSiteScenario,
  selectSiteScenarios,
  SITE_TARGETING_SEMANTIC_NEGATIVE_CONTROL_KINDS,
  validateSiteScenarioCatalog,
} from './scenarioContracts.mjs';
import {
  LAYOUT_CYCLE_ORACLE_KIND,
  LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_SELECTOR,
  LAYOUT_CYCLE_OPPORTUNITY_KIND,
  LAYOUT_CYCLE_ORACLE_RELATION,
} from './layoutCycleAnalysis.mjs';

const SOCIAL_FEEDBACK_VIEW_TIME = Object.freeze({
  feedbackCounts: true,
  viewCounts: true,
  timeSignals: true,
  audienceCounts: false,
});

const SOCIAL_FEEDBACK_TIME = Object.freeze({
  feedbackCounts: true,
  viewCounts: false,
  timeSignals: true,
  audienceCounts: false,
});

const YOUTUBE_SETTINGS = createIsolatedScenarioSettings({
  videoSkipGuard: {
    isActive: true,
    value: {
      mode: 'hard_block',
    },
  },
  shortFormBlock: true,
  socialMetrics: {
    isActive: true,
    value: SOCIAL_FEEDBACK_VIEW_TIME,
  },
});

const ROOT_VISUAL_CONTINUITY_SETTINGS = createIsolatedScenarioSettings({
  saturation: true,
});

const REDDIT_SETTINGS = createIsolatedScenarioSettings({
  socialMetrics: {
    isActive: true,
    value: SOCIAL_FEEDBACK_TIME,
  },
});

const TIKTOK_SETTINGS = createIsolatedScenarioSettings({
  ensoGate: true,
});

const TIKTOK_PAGED_FEED_INPUTS = Object.freeze(
  Array.from({ length: 7 }, () => Object.freeze({
    kind: 'trusted_wheel',
    maximumDeltaY: 900,
  })),
);

const YOUTUBE_SHORTS_FEED_SETTINGS = createIsolatedScenarioSettings({
  ensoGate: true,
});

const AUTHENTICATED_FEED_HORIZON_SETTINGS = createIsolatedScenarioSettings({
  ensoGate: true,
});

const CONTROL_SETTINGS = createIsolatedScenarioSettings({
  textRhythm: true,
});

const RUNTIME_CONTENTION_SETTINGS = createIsolatedScenarioSettings({
  blur: true,
  scrollFriction: true,
  textRhythm: true,
});

const RUNTIME_CONTENTION_SETTINGS_BY_PROFILE = deepFreezeScenarioValue({
  combined: RUNTIME_CONTENTION_SETTINGS,
  scroll: createIsolatedScenarioSettings({
    scrollFriction: true,
  }),
  visual: createIsolatedScenarioSettings({
    blur: true,
  }),
  text: createIsolatedScenarioSettings({
    textRhythm: true,
  }),
});

const WATCH_RUNTIME_SETTINGS_BY_PROFILE = deepFreezeScenarioValue({
  combined: createIsolatedScenarioSettings({
    blur: true,
    scrollFriction: true,
    textRhythm: true,
    socialMetrics: {
      isActive: true,
      value: SOCIAL_FEEDBACK_VIEW_TIME,
    },
  }),
  scroll: RUNTIME_CONTENTION_SETTINGS_BY_PROFILE.scroll,
  visual: RUNTIME_CONTENTION_SETTINGS_BY_PROFILE.visual,
  text: RUNTIME_CONTENTION_SETTINGS_BY_PROFILE.text,
  social: createIsolatedScenarioSettings({
    socialMetrics: {
      isActive: true,
      value: SOCIAL_FEEDBACK_VIEW_TIME,
    },
  }),
});

const MEDIA_TARGETING_SETTINGS = createIsolatedScenarioSettings({
  blur: true,
});

const TEXT_TARGETING_SETTINGS = createIsolatedScenarioSettings({
  textRhythm: true,
});

const LOGIN_SOCIAL_SETTINGS = createIsolatedScenarioSettings({
  socialMetrics: {
    isActive: true,
    value: SOCIAL_FEEDBACK_VIEW_TIME,
  },
});

const FACEBOOK_LOGIN_SETTINGS = createIsolatedScenarioSettings({
  shortFormBlock: true,
  socialMetrics: {
    isActive: true,
    value: SOCIAL_FEEDBACK_VIEW_TIME,
  },
});

const TIKTOK_LOGIN_SETTINGS = createIsolatedScenarioSettings({
  shortFormBlock: true,
  socialMetrics: {
    isActive: true,
    value: {
      feedbackCounts: true,
      viewCounts: true,
      timeSignals: true,
      audienceCounts: true,
    },
  },
});

const ARTIFACT_DISCLOSURE_REQUIREMENT_BY_FEATURE = deepFreezeScenarioValue({
  saturation: {
    featureId: 'saturation',
    familyId: 'lens',
    childId: 'grayscale',
    disclosureDay: 0,
  },
  blur: {
    featureId: 'blur',
    familyId: 'lens',
    childId: 'blur',
    disclosureDay: 0,
  },
  scrollFriction: {
    featureId: 'scrollFriction',
    familyId: 'brake',
    childId: 'scrollFriction',
    disclosureDay: 2,
  },
  textRhythm: {
    featureId: 'textRhythm',
    familyId: 'barrier',
    childId: 'textRhythm',
    disclosureDay: 3,
  },
  inputVisualBrake: {
    featureId: 'inputVisualBrake',
    familyId: 'brake',
    childId: 'inputVisualBrake',
    disclosureDay: 2,
  },
  videoSkipGuard: {
    featureId: 'videoSkipGuard',
    familyId: 'brake',
    childId: 'skipFriction',
    disclosureDay: 2,
  },
  shortFormBlock: {
    featureId: 'shortFormBlock',
    familyId: 'veil',
    childId: 'shortformBlock',
    disclosureDay: 5,
  },
  clickDelay: {
    featureId: 'clickDelay',
    familyId: 'brake',
    childId: 'clickPause',
    disclosureDay: 2,
  },
  ensoGate: {
    featureId: 'ensoGate',
    familyId: 'barrier',
    childId: 'intentThreshold',
    disclosureDay: 3,
  },
  socialMetrics: {
    featureId: 'socialMetrics',
    familyId: 'veil',
    childId: 'socialMetrics',
    disclosureDay: 5,
  },
});

function createArtifactDisclosureRequirements(featureIds) {
  const byFeature = Object.fromEntries(featureIds.map((featureId) => {
    const requirement = ARTIFACT_DISCLOSURE_REQUIREMENT_BY_FEATURE[featureId];
    if (!requirement) {
      throw new Error(`SITE_SCENARIO_ARTIFACT_DISCLOSURE_FEATURE_UNKNOWN:${featureId}`);
    }
    return [featureId, requirement];
  }));
  return {
    byFeature,
    scenarioMaxDay: Math.max(
      ...Object.values(byFeature).map((requirement) => requirement.disclosureDay),
    ),
  };
}

const GLOBAL_FORBIDDEN_ACTIONS = Object.freeze([
  'read_login_credentials',
  'write_login_credentials',
  'post_content',
  'submit_form',
  'purchase',
  'download',
  'upload',
  'change_account_settings',
  'change_privacy_settings',
  'change_security_settings',
  'delete_data',
  'bypass_captcha',
  'bypass_two_factor',
  'accept_terms',
]);

function createAuthMetadata(mode) {
  const requiresExplicitQaProfile = mode === 'qa_profile_required';
  return {
    mode,
    requiresExplicitQaProfile,
    credentialAccess: 'forbidden',
    storePageContent: false,
    screenshots: 'opt_in_only',
    traces: 'opt_in_only',
  };
}

function createExecution(mode, {
  requiresExplicitQaProfile = mode === 'metadata_only',
} = {}) {
  return {
    mode,
    requiresExplicitQaProfile,
    disposableProfileByDefault: mode === 'automated' && !requiresExplicitQaProfile,
  };
}

function createBlockerClassifiers({ authenticatedSuite = false } = {}) {
  return [
    {
      classification: 'blocked',
      match: 'any',
      signalIds: [
        'captcha_present',
        'two_factor_present',
        'terms_consent_present',
        'robot_check_present',
        'http_403',
        'http_429',
        'geo_block_present',
      ],
      takeoverCheckpoint: true,
    },
    {
      classification: 'auth_required',
      match: 'any',
      signalIds: authenticatedSuite
        ? ['qa_profile_missing', 'session_not_authenticated', 'login_wall_present']
        : ['login_route_reached', 'login_wall_present', 'session_required'],
      takeoverCheckpoint: true,
    },
    {
      classification: 'contract_drift',
      match: 'any',
      signalIds: [
        'owner_readiness_missing_after_load',
        'configured_selector_invalid',
        'canonical_surface_shape_missing',
      ],
      takeoverCheckpoint: false,
    },
    {
      classification: 'inconclusive',
      match: 'any',
      signalIds: [
        'valid_surface_has_no_candidates',
        'experiment_surface_empty',
        'bounded_actions_insufficient',
      ],
      takeoverCheckpoint: false,
    },
  ];
}

function createExpectedActivation(settings, {
  runtimeDerivedKeys = [],
  activeMetricKeys = null,
  compiledPlanCount = null,
} = {}) {
  return {
    activeFilterKeys: [...settings.activeKeys, ...runtimeDerivedKeys],
    runtimeDerivedKeys: [...runtimeDerivedKeys],
    socialMetrics: activeMetricKeys
      ? {
        activeMetricKeys: [...activeMetricKeys],
        compiledPlanCount,
        observerAttached: true,
      }
      : null,
  };
}

function bothAction(kind, details = {}) {
  return { kind, lane: 'both', ...details };
}

function createPagedTrustedFeedJourney({
  minimumDwellMs,
  inputs,
} = {}) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error('SITE_SCENARIO_PAGED_FEED_INPUTS_REQUIRED');
  }
  return inputs.map((input, index) => bothAction(input.kind, {
    ...input,
    feedStepId: `feed-step-${index + 1}`,
    minimumDwellMs,
    requiresTrustedGesture: true,
  }));
}

function diagnosticCondition(id, kind, details = {}) {
  return { id, kind, lane: 'diagnostic', ...details };
}

function bothCondition(id, kind, details = {}) {
  return { id, kind, lane: 'both', ...details };
}

function createSocialSettleConditions() {
  return [
    diagnosticCondition('social-queue-empty', 'debug_path_equals', {
      path: 'socialMetrics.queueLength',
      expected: 0,
    }),
    diagnosticCondition('social-dirty-roots-empty', 'debug_path_equals', {
      path: 'socialMetrics.pendingMutationRootCount',
      expected: 0,
    }),
    diagnosticCondition('social-timer-clear', 'debug_path_equals', {
      path: 'socialMetrics.scanTimerScheduled',
      expected: false,
    }),
    diagnosticCondition('social-idle-clear', 'debug_path_equals', {
      path: 'socialMetrics.idleScheduled',
      expected: false,
    }),
    bothCondition('dom-samples-stable', 'stable_samples', {
      samples: 2,
      intervalMs: 400,
    }),
  ];
}

function createSocialObservableEffects(candidateSelectors) {
  const appliedSelectors = [
    '[data-friction-social-engagement="1"]',
    '[data-friction-social-exposure="1"]',
  ];
  const rootAttributes = ['data-friction-social-metrics'];
  return {
    candidateSelectors,
    appliedSelectors,
    rootAttributes,
    disableCleanup: {
      scope: 'user_settings',
      selectors: appliedSelectors,
      rootAttributes,
    },
    conditions: [
      bothCondition('social-marker-applied', 'selector_any_applied', { minimum: 1 }),
      bothCondition('social-target-hidden', 'computed_visibility', { expected: 'hidden' }),
      diagnosticCondition('social-owner-ready', 'debug_paths_match', {
        expected: {
          'socialMetrics.active': true,
          'socialMetrics.observerAttached': true,
        },
      }),
    ],
  };
}

function createTargetingScenario({
  id,
  siteId,
  effect,
  url,
  origin,
  readinessSelectors,
  positiveSelectors,
  negativeSelectors,
  semanticNegativeControls = [],
  positiveGeometry,
  suite = 'targeting-core',
  qaProfileRequired = false,
  membershipProbe = false,
}) {
  const media = effect === 'media';
  const settings = media ? MEDIA_TARGETING_SETTINGS : TEXT_TARGETING_SETTINGS;
  const rootAttribute = media
    ? 'data-friction-visual'
    : 'data-friction-text-active';
  const rootAppliedSelector = `html[${rootAttribute}="1"]`;
  return defineSiteScenario({
    id,
    suites: [suite],
    siteId,
    featureGroup: media ? 'basic-media-targeting' : 'basic-text-targeting',
    execution: createExecution(qaProfileRequired ? 'metadata_only' : 'automated'),
    auth: createAuthMetadata(
      qaProfileRequired ? 'qa_profile_required' : 'public_no_login',
    ),
    urls: {
      primary: url,
      additional: [],
    },
    allowlistedOrigins: [origin],
    redirectOrigins: [],
    settings,
    artifactDisclosureRequirements: createArtifactDisclosureRequirements([
      media ? 'blur' : 'textRhythm',
    ]),
    expectedActivation: createExpectedActivation(settings),
    readiness: {
      selectorMatch: 'any',
      selectors: readinessSelectors,
      conditions: [
        bothCondition('document-complete', 'document_ready_state', { expected: 'complete' }),
        bothCondition('targeting-positive-present', 'selector_any_present', {
          selectors: positiveSelectors,
        }),
      ],
    },
    actions: [
      ...(qaProfileRequired
        ? [bothAction('takeover_checkpoint', { reason: 'authentication' })]
        : []),
      bothAction('settings_patch', {
        ...(qaProfileRequired ? { requiresExplicitQaProfile: true } : {}),
      }),
      bothAction('navigate', {
        urlId: 'primary',
        ...(qaProfileRequired ? { requiresExplicitQaProfile: true } : {}),
      }),
      bothAction('scroll', {
        maximumSteps: 4,
        maximumDeltaY: 900,
        minimumDwellMs: 350,
        ...(qaProfileRequired ? { requiresExplicitQaProfile: true } : {}),
      }),
      bothAction('reload', {
        maximumCount: 1,
        ...(qaProfileRequired ? { requiresExplicitQaProfile: true } : {}),
      }),
      bothAction('scroll', {
        maximumSteps: 2,
        maximumDeltaY: 700,
        minimumDwellMs: 350,
        ...(qaProfileRequired ? { requiresExplicitQaProfile: true } : {}),
      }),
      ...(membershipProbe ? [bothAction('visual_media_membership_probe', {
        requiredForEvaluation: true,
      })] : []),
      bothAction('disable', {
        ...(qaProfileRequired ? { requiresExplicitQaProfile: true } : {}),
      }),
      bothAction('reenable', {
        ...(qaProfileRequired ? { requiresExplicitQaProfile: true } : {}),
      }),
    ],
    observableEffects: {
      candidateSelectors: positiveSelectors,
      appliedSelectors: [rootAppliedSelector],
      rootAttributes: [rootAttribute],
      disableCleanup: {
        scope: 'user_settings',
        selectors: [rootAppliedSelector],
        rootAttributes: [rootAttribute],
      },
      targetingOracle: {
        kind: 'computed_style_delta',
        positiveSelectors,
        negativeSelectors,
        semanticNegativeControls,
        styleProperties: media
          ? ['filter']
          : ['filter', 'opacity'],
        maximumSamplesPerSelector: 4,
        positiveGeometry,
      },
      conditions: [
        bothCondition('targeting-root-active', 'root_attributes_present', { minimum: 1 }),
        bothCondition('targeting-style-changed', 'computed_style_changed', {
          properties: media
            ? ['filter']
            : ['filter', 'opacity'],
          compareTo: 'disabled_baseline',
        }),
        diagnosticCondition(
          media ? 'visual-owner-ready' : 'text-owner-ready',
          'debug_paths_match',
          {
            expected: media
              ? {
                'effects.visual.active': true,
                'effects.visual.observerAttached': true,
              }
              : {
                'effects.textShuffle.active': true,
              },
          },
        ),
      ],
    },
    settle: {
      conditions: [
        ...(media
          ? [diagnosticCondition('media-rechecks-empty', 'debug_path_in', {
            path: 'effects.visual.pendingRecheckCount',
            waitTimeoutMs: 18_000,
            expected: [0],
            unmetState: 'active_pending',
          })]
          : [
            bothCondition('shuffle-pending-clear', 'root_attribute_absent', {
              attribute: 'data-friction-text-shuffle-pending',
            }),
            diagnosticCondition('text-nodes-settled', 'debug_paths_match', {
              expected: {
                'effects.textShuffle.pendingTextNodeCount': 0,
                'effects.textShuffle.pendingSubtreeCount': 0,
                'effects.textShuffle.pendingSubtreeTaskCount': 0,
              },
            }),
          ]),
        bothCondition('dom-samples-stable', 'stable_samples', {
          samples: 2,
          intervalMs: 400,
        }),
      ],
    },
    forbiddenActions: [
      ...GLOBAL_FORBIDDEN_ACTIONS,
      'like',
      'follow',
      'subscribe',
      'comment',
      'share',
      'click_ad',
      'click_external_link',
    ],
    blockerClassifiers: createBlockerClassifiers({
      authenticatedSuite: qaProfileRequired,
    }),
  });
}

const RELEASE_CORE_SCENARIOS = [
  defineSiteScenario({
    id: 'youtube-public-core',
    suites: ['release-core'],
    siteId: 'youtube',
    featureGroup: 'video-shortform-social',
    execution: createExecution('automated'),
    auth: createAuthMetadata('public_no_login'),
    urls: {
      primary: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      additional: [
        'https://www.youtube.com/shorts/3_YhyeHjOWI',
        'https://www.youtube.com/channel/UCBR8-60-B28hp2BmDPdntcQ/shorts',
      ],
    },
    allowlistedOrigins: ['https://www.youtube.com'],
    redirectOrigins: [],
    settings: YOUTUBE_SETTINGS,
    artifactDisclosureRequirements: createArtifactDisclosureRequirements([
      'videoSkipGuard',
      'shortFormBlock',
      'socialMetrics',
    ]),
    expectedActivation: createExpectedActivation(YOUTUBE_SETTINGS, {
      activeMetricKeys: ['feedbackCounts', 'viewCounts', 'timeSignals'],
      compiledPlanCount: 2,
    }),
    readiness: {
      selectorMatch: 'any',
      selectors: [
        'ytd-watch-metadata',
        '#movie_player video',
        'video.html5-main-video',
      ],
      conditions: [
        bothCondition('document-complete', 'document_ready_state', { expected: 'complete' }),
        bothCondition('watch-route', 'url_path_equals', { expected: '/watch' }),
        bothCondition('video-metadata-ready', 'media_ready_state', {
          selector: 'video',
          minimumReadyState: 1,
        }),
        diagnosticCondition('video-handlers-attached', 'debug_event_seen', {
          feature: 'videoSkipGuard',
          event: 'video_handlers_attached',
        }),
        diagnosticCondition('social-baseline-covered', 'debug_baseline_covered', {
          probeId: 'socialMetrics',
          onMissing: 'rebaseline',
        }),
      ],
    },
    actions: [
      bothAction('settings_patch'),
      bothAction('navigate', { urlId: 'additional:0', expectedRedirectPath: '/' }),
      bothAction('navigate', { urlId: 'additional:1' }),
      bothAction('wait', { ms: 1500 }),
      bothAction('scroll', {
        maximumSteps: 6,
        maximumDeltaY: 900,
        minimumDwellMs: 300,
      }),
      bothAction('navigate', { urlId: 'primary' }),
      bothAction('play', {
        maximumDurationMs: 3000,
        targetSelector: '.ytp-play-button',
        requiresTrustedGesture: true,
        requiredForEvaluation: true,
        observationWindowMs: 1500,
      }),
      bothAction('pause'),
      bothAction('seek', {
        direction: 'forward',
        maximumSeconds: 5,
        targetSelector: '.ytp-progress-bar',
        requiresBufferedTarget: true,
        requiresTrustedGesture: true,
        requiredForEvaluation: true,
        revertObservationWindowMs: 1200,
      }),
      bothAction('scroll', { maximumSteps: 4, maximumDeltaY: 900 }),
      bothAction('reload', { maximumCount: 1 }),
      bothAction('scroll', {
        maximumSteps: 2,
        maximumDeltaY: 700,
        minimumDwellMs: 300,
      }),
      bothAction('disable'),
      bothAction('reenable'),
    ],
    observableEffects: {
      candidateSelectors: [
        '#vote-count-middle',
        'ytd-video-view-count-renderer span',
        '#metadata-line .inline-metadata-item',
        '#info-strings yt-formatted-string',
      ],
      appliedSelectors: [
        '[data-friction-social-engagement="1"]',
        '[data-friction-social-exposure="1"]',
        'video[data-friction-skip-reverting="1"]',
      ],
      rootAttributes: [
        'data-friction-shortform-block',
        'data-friction-social-metrics',
      ],
      disableCleanup: {
        scope: 'user_settings',
        selectors: [
          '[data-friction-social-engagement="1"]',
          '[data-friction-social-exposure="1"]',
        ],
        rootAttributes: ['data-friction-social-metrics'],
      },
      layoutCycleOracle: {
        kind: LAYOUT_CYCLE_ORACLE_KIND,
        opportunityKind: LAYOUT_CYCLE_OPPORTUNITY_KIND,
        relation: LAYOUT_CYCLE_ORACLE_RELATION,
        ownerMarkerSelector: '[data-friction-youtube-metadata-collapsed]',
        ownedMetricSelectors: [
          '[data-friction-social-engagement="1"]',
          '[data-friction-social-exposure="1"]',
        ],
        collapsedContainerSelectors: [
          LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_SELECTOR,
          'ytd-watch-metadata #metadata-line',
          'ytd-watch-metadata .yt-content-metadata-view-model__metadata-row',
          'ytd-watch-metadata .ytContentMetadataViewModelMetadataRow',
          'ytd-watch-metadata [role="group"]',
        ],
        restoredCandidateSelectors: [
          LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_SELECTOR,
          'ytd-watch-metadata #metadata-line',
          'ytd-watch-metadata .yt-content-metadata-view-model__metadata-row',
          'ytd-watch-metadata .ytContentMetadataViewModelMetadataRow',
          'ytd-watch-metadata [role="group"]',
        ],
      },
      conditions: [
        diagnosticCondition('shortform-owner-applied', 'debug_event_seen', {
          feature: 'shortFormBlock',
          event: 'manager_apply',
        }),
        bothCondition('seek-position-restored', 'media_seek_reverted', {
          maximumDriftSeconds: 1.5,
        }),
        diagnosticCondition('seek-block-event', 'debug_event_seen', {
          feature: 'videoSkipGuard',
          event: 'seek_blocked_hard_block',
        }),
        bothCondition('social-marker-applied', 'selector_any_applied', { minimum: 1 }),
        bothCondition('social-target-hidden', 'computed_visibility', { expected: 'hidden' }),
      ],
    },
    settle: {
      conditions: [
        ...createSocialSettleConditions(),
        diagnosticCondition(
          'shortform-opportunity-effect-complete',
          'debug_shortform_completeness',
          {
            path: 'shortForm.completeness',
            noOpportunityStatus: 'WARN',
          },
        ),
        bothCondition('skip-revert-finished', 'selector_absent', {
          selector: 'video[data-friction-skip-reverting="1"]',
        }),
      ],
    },
    forbiddenActions: [
      ...GLOBAL_FORBIDDEN_ACTIONS,
      'like',
      'subscribe',
      'comment',
      'share',
      'click_ad',
      'click_external_link',
    ],
    blockerClassifiers: createBlockerClassifiers(),
  }),
  defineSiteScenario({
    id: 'youtube-shorts-feed-horizon',
    suites: ['release-core'],
    siteId: 'youtube',
    featureGroup: 'paged-feed-flow',
    execution: createExecution('automated'),
    auth: createAuthMetadata('public_no_login'),
    urls: {
      primary: 'https://www.youtube.com/shorts/3_YhyeHjOWI',
      additional: [],
    },
    allowlistedOrigins: ['https://www.youtube.com'],
    redirectOrigins: [],
    settings: YOUTUBE_SHORTS_FEED_SETTINGS,
    artifactDisclosureRequirements: createArtifactDisclosureRequirements(['ensoGate']),
    expectedActivation: createExpectedActivation(YOUTUBE_SHORTS_FEED_SETTINGS, {
      runtimeDerivedKeys: ['infiniteScrollGuard'],
    }),
    readiness: {
      selectorMatch: 'any',
      selectors: [
        '#shorts-container',
        '#shorts-inner-container',
        'ytd-reel-video-renderer',
        'video[playsinline]',
      ],
      conditions: [
        bothCondition('document-complete', 'document_ready_state', { expected: 'complete' }),
        diagnosticCondition('feed-profile-youtube', 'debug_path_equals', {
          path: 'feedFlow.semantic.readiness.profileId',
          expected: 'youtube',
        }),
        diagnosticCondition('feed-readiness-ready', 'debug_path_equals', {
          path: 'feedFlow.semantic.readiness.status',
          expected: 'ready',
          evidencePath: 'feedFlow.semantic.readiness',
          minimumFeedOpportunityCount: 2,
        }),
        diagnosticCondition('feed-capability-paged', 'debug_path_equals', {
          path: 'feedFlow.semantic.readiness.capability',
          expected: 'paged_hold',
          evidencePath: 'feedFlow.semantic.readiness',
          minimumFeedOpportunityCount: 2,
        }),
      ],
    },
    feedConsumption: {
      surfaceMode: 'paged',
      oracle: {
        kind: 'dominant_item',
        selectors: [
          'ytd-reel-video-renderer',
          '#shorts-inner-container > div.reel-video-in-sequence-new',
          'video[playsinline]',
        ],
        maximumCandidates: 32,
        minimumProgressRatio: 0.2,
        readinessTimeoutMs: 8_000,
        minimumStableSamples: 2,
      },
    },
    actions: [
      bothAction('settings_patch'),
      bothAction('navigate', { urlId: 'primary' }),
      ...createPagedTrustedFeedJourney({
        minimumDwellMs: 1_100,
        inputs: Array.from({ length: 7 }, () => ({
          kind: 'trusted_wheel',
          targetSelector: '#shorts-container',
          maximumDeltaY: 900,
        })),
      }),
      bothAction('disable'),
      bothAction('reenable'),
    ],
    observableEffects: {
      candidateSelectors: [
        '#shorts-container',
        'ytd-reel-video-renderer',
        'video[playsinline]',
      ],
      appliedSelectors: [
        '#entropy-feed-terminus',
        '#entropy-feed-endpoint-marker',
        '#entropy-feed-endpoint-tail',
        '#entropy-feed-endpoint-quarantine',
      ],
      rootAttributes: ['data-enso-gate-active'],
      rootAttributeActiveValues: {
        'data-enso-gate-active': 'active',
      },
      disableCleanup: {
        scope: 'user_settings',
        selectors: [
          '#entropy-feed-terminus',
          '#entropy-feed-endpoint-marker',
          '#entropy-feed-endpoint-tail',
          '#entropy-feed-endpoint-quarantine',
        ],
        rootAttributes: ['data-enso-gate-active'],
      },
      conditions: [
        diagnosticCondition('feed-transitions-measured', 'debug_counter_increased', {
          paths: [
            'feedFlow.ledger.counters.advanceCount',
            'feedFlow.semantic.metrics.advanceCount',
            'feedFlow.semantic.metrics.itemTransitions',
          ],
          minimum: 1,
        }),
        diagnosticCondition('feed-consumption-exact-match', 'debug_feed_consumption_journey', {
          path: 'feedFlow.ledger',
        }),
        diagnosticCondition('feed-supply-settled', 'debug_path_equals', {
          path: 'feedFlow.readout.pendingStep',
          expected: false,
          evidencePath: 'feedFlow.readout',
        }),
        diagnosticCondition('feed-semantic-pressure-observed', 'debug_path_in', {
          path: 'feedFlow.semantic.state',
          expected: ['pressure', 'interrupt'],
          unmetState: 'armed_idle',
        }),
        diagnosticCondition('feed-horizon-admission-evaluated', 'debug_path_in', {
          path: 'feedFlow.episode.admission.status',
          expected: ['withheld', 'admitted'],
          unmetState: 'unavailable',
          evidencePath: 'feedFlow.episode',
        }),
        bothCondition('feed-horizon-presented', 'selector_any_applied', {
          minimum: 1,
          conditionalOn: 'feedFlow.episode.admission.status=admitted',
        }),
      ],
    },
    settle: {
      conditions: [
        bothCondition('feed-artifacts-clean-after-disable', 'selectors_absent_after_disable', {
          selectors: [
            '#entropy-feed-terminus',
            '#entropy-feed-endpoint-marker',
            '#entropy-feed-endpoint-tail',
            '#entropy-feed-endpoint-quarantine',
          ],
        }),
        bothCondition('dom-samples-stable', 'stable_samples', {
          samples: 2,
          intervalMs: 500,
        }),
      ],
    },
    forbiddenActions: [
      ...GLOBAL_FORBIDDEN_ACTIONS,
      'like',
      'subscribe',
      'comment',
      'share',
      'click_channel',
    ],
    blockerClassifiers: createBlockerClassifiers(),
  }),
  defineSiteScenario({
    id: 'reddit-public-metrics',
    suites: ['release-core'],
    siteId: 'reddit',
    featureGroup: 'semantic-social-metrics',
    execution: createExecution('automated'),
    auth: createAuthMetadata('public_no_login'),
    urls: {
      primary: 'https://www.reddit.com/r/popular/',
      additional: [],
    },
    allowlistedOrigins: ['https://www.reddit.com'],
    redirectOrigins: [],
    settings: REDDIT_SETTINGS,
    artifactDisclosureRequirements: createArtifactDisclosureRequirements(['socialMetrics']),
    expectedActivation: createExpectedActivation(REDDIT_SETTINGS, {
      activeMetricKeys: ['feedbackCounts', 'timeSignals'],
      compiledPlanCount: 2,
    }),
    readiness: {
      selectorMatch: 'any',
      selectors: [
        'shreddit-post',
        '[data-testid="post-container"]',
        'article',
      ],
      conditions: [
        bothCondition('document-complete', 'document_ready_state', { expected: 'complete' }),
        bothCondition('metric-candidate-present', 'selector_any_present', {
          selectors: ['faceplate-number', 'faceplate-timeago time[datetime]'],
        }),
        diagnosticCondition('social-baseline-covered', 'debug_baseline_covered', {
          probeId: 'socialMetrics',
          onMissing: 'rebaseline',
        }),
      ],
    },
    actions: [
      bothAction('settings_patch'),
      bothAction('navigate', { urlId: 'primary' }),
      bothAction('scroll', { maximumSteps: 4, maximumDeltaY: 900 }),
      bothAction('reload', { maximumCount: 1 }),
      bothAction('scroll', {
        maximumSteps: 2,
        maximumDeltaY: 700,
        minimumDwellMs: 300,
      }),
      bothAction('disable'),
      bothAction('reenable'),
    ],
    observableEffects: createSocialObservableEffects([
      '[data-testid="action-row"] faceplate-number',
      '[data-post-click-location="vote"] faceplate-number',
      'faceplate-timeago time[datetime]',
    ]),
    settle: { conditions: createSocialSettleConditions() },
    forbiddenActions: [
      ...GLOBAL_FORBIDDEN_ACTIONS,
      'upvote',
      'downvote',
      'comment',
      'save',
      'share',
      'report',
      'click_external_link',
    ],
    blockerClassifiers: createBlockerClassifiers(),
  }),
  defineSiteScenario({
    id: 'tiktok-public-feed',
    suites: ['release-core'],
    siteId: 'tiktok',
    featureGroup: 'paged-feed-flow',
    execution: createExecution('automated'),
    auth: createAuthMetadata('public_no_login'),
    urls: {
      primary: 'https://www.tiktok.com/foryou',
      additional: [],
    },
    allowlistedOrigins: ['https://www.tiktok.com'],
    redirectOrigins: [],
    settings: TIKTOK_SETTINGS,
    artifactDisclosureRequirements: createArtifactDisclosureRequirements(['ensoGate']),
    expectedActivation: createExpectedActivation(TIKTOK_SETTINGS, {
      runtimeDerivedKeys: ['infiniteScrollGuard'],
    }),
    readiness: {
      selectorMatch: 'any',
      selectors: [
        '[data-e2e="recommend-list-item-container"]',
        '[data-e2e*="feed-item" i]',
        '[data-e2e*="video-player" i]',
        'video',
      ],
      conditions: [
        bothCondition('document-complete', 'document_ready_state', { expected: 'complete' }),
        diagnosticCondition('feed-profile-tiktok', 'debug_path_equals', {
          path: 'feedFlow.semantic.readiness.profileId',
          expected: 'tiktok',
        }),
        diagnosticCondition('feed-readiness-ready', 'debug_path_equals', {
          path: 'feedFlow.semantic.readiness.status',
          expected: 'ready',
          evidencePath: 'feedFlow.semantic.readiness',
          minimumFeedOpportunityCount: 2,
        }),
        diagnosticCondition('feed-capability-paged', 'debug_path_equals', {
          path: 'feedFlow.semantic.readiness.capability',
          expected: 'paged_hold',
          evidencePath: 'feedFlow.semantic.readiness',
          minimumFeedOpportunityCount: 2,
        }),
      ],
    },
    feedConsumption: {
      surfaceMode: 'paged',
      oracle: {
        kind: 'dominant_item',
        selectors: [
          '[data-e2e="recommend-list-item-container"]',
          '[data-e2e="user-post-item"]',
          '[data-e2e*="feed-item" i]',
          '[data-e2e*="video-item" i]',
          '[data-e2e*="browse-video" i]',
          '[data-e2e*="video-player" i]',
          '[data-e2e*="recommend-video" i]',
          'video',
        ],
        maximumCandidates: 48,
        minimumProgressRatio: 0.2,
        readinessTimeoutMs: 8_000,
        minimumStableSamples: 2,
      },
    },
    actions: [
      bothAction('settings_patch'),
      bothAction('navigate', { urlId: 'primary' }),
      ...createPagedTrustedFeedJourney({
        minimumDwellMs: 1_100,
        inputs: TIKTOK_PAGED_FEED_INPUTS,
      }),
      bothAction('play', {
        maximumDurationMs: 2000,
        optional: true,
        targetSelector: 'video',
        requiresTrustedGesture: true,
        observationWindowMs: 1500,
      }),
      bothAction('pause', { optional: true }),
      bothAction('disable'),
      bothAction('reenable'),
    ],
    observableEffects: {
      candidateSelectors: [
        '[data-e2e="recommend-list-item-container"]',
        '[data-e2e*="video-item" i]',
        'video',
      ],
      appliedSelectors: [
        '#entropy-feed-terminus',
        '#entropy-feed-endpoint-marker',
        '#entropy-feed-endpoint-tail',
        '#entropy-feed-endpoint-quarantine',
      ],
      rootAttributes: ['data-enso-gate-active'],
      rootAttributeActiveValues: {
        'data-enso-gate-active': 'active',
      },
      disableCleanup: {
        scope: 'user_settings',
        selectors: [
          '#entropy-feed-terminus',
          '#entropy-feed-endpoint-marker',
          '#entropy-feed-endpoint-tail',
          '#entropy-feed-endpoint-quarantine',
        ],
        rootAttributes: ['data-enso-gate-active'],
      },
      conditions: [
        diagnosticCondition('feed-transitions-measured', 'debug_counter_increased', {
          paths: [
            'feedFlow.ledger.counters.advanceCount',
            'feedFlow.semantic.metrics.advanceCount',
            'feedFlow.semantic.metrics.itemTransitions',
          ],
          minimum: 1,
        }),
        diagnosticCondition('feed-tempo-observe-only', 'debug_path_equals', {
          path: 'feedFlow.tempo.mode',
          expected: 'observe_only',
        }),
        diagnosticCondition('feed-tempo-persistence-owner', 'debug_path_equals', {
          path: 'feedFlow.tempo.persistence',
          expected: 'indexeddb_checkpoint',
        }),
        diagnosticCondition('feed-tempo-checkpoint-ready', 'debug_path_equals', {
          path: 'feedFlow.tempo.checkpoint.state',
          expected: 'ready',
        }),
        diagnosticCondition('feed-tempo-cost-measured', 'debug_path_equals', {
          path: 'feedFlow.tempo.cost.measurementState',
          expected: 'measured',
        }),
        diagnosticCondition('feed-tempo-dwell-observed', 'debug_counter_increased', {
          paths: [
            'feedFlow.tempo.trajectory.counters.eligibleDwellCount',
          ],
          minimum: 1,
        }),
        diagnosticCondition('feed-consumption-exact-match', 'debug_feed_consumption_journey', {
          path: 'feedFlow.ledger',
        }),
        diagnosticCondition('feed-supply-settled', 'debug_path_equals', {
          path: 'feedFlow.readout.pendingStep',
          expected: false,
          evidencePath: 'feedFlow.readout',
        }),
        diagnosticCondition('feed-semantic-pressure-observed', 'debug_path_in', {
          path: 'feedFlow.semantic.state',
          expected: ['pressure', 'interrupt'],
          unmetState: 'armed_idle',
        }),
        diagnosticCondition('feed-horizon-admission-evaluated', 'debug_path_in', {
          path: 'feedFlow.episode.admission.status',
          expected: ['withheld', 'admitted'],
          unmetState: 'unavailable',
          evidencePath: 'feedFlow.episode',
        }),
        bothCondition('feed-horizon-presented', 'selector_any_applied', {
          minimum: 1,
          conditionalOn: 'feedFlow.episode.admission.status=admitted',
        }),
      ],
    },
    settle: {
      conditions: [
        diagnosticCondition('feed-tempo-profile-restored', 'debug_number_at_least', {
          path: 'feedFlow.tempo.profile.sampleCount',
          minimum: 1,
          minimumFeedOpportunityCount: 1,
        }),
        diagnosticCondition('feed-tempo-checkpoint-revision-restored', 'debug_number_at_least', {
          path: 'feedFlow.tempo.profile.checkpointStateRevision',
          minimum: 0,
          minimumFeedOpportunityCount: 1,
        }),
        diagnosticCondition('feed-tempo-persisted-ready', 'debug_path_equals', {
          path: 'feedFlow.tempo.checkpoint.state',
          expected: 'ready',
        }),
        bothCondition('feed-artifacts-clean-after-disable', 'selectors_absent_after_disable', {
          selectors: [
            '#entropy-feed-terminus',
            '#entropy-feed-endpoint-marker',
            '#entropy-feed-endpoint-tail',
            '#entropy-feed-endpoint-quarantine',
          ],
        }),
        bothCondition('dom-samples-stable', 'stable_samples', {
          samples: 2,
          intervalMs: 500,
        }),
      ],
    },
    forbiddenActions: [
      ...GLOBAL_FORBIDDEN_ACTIONS,
      'like',
      'follow',
      'comment',
      'share',
      'click_profile',
    ],
    blockerClassifiers: createBlockerClassifiers(),
  }),
  defineSiteScenario({
    id: 'example-generic-control',
    suites: ['release-core'],
    siteId: 'default',
    featureGroup: 'generic-text-rhythm-control',
    execution: createExecution('automated'),
    auth: createAuthMetadata('public_no_login'),
    urls: {
      primary: 'https://example.com/',
      additional: [],
    },
    allowlistedOrigins: ['https://example.com'],
    redirectOrigins: [],
    settings: CONTROL_SETTINGS,
    artifactDisclosureRequirements: createArtifactDisclosureRequirements(['textRhythm']),
    expectedActivation: createExpectedActivation(CONTROL_SETTINGS),
    readiness: {
      selectorMatch: 'any',
      selectors: ['main h1', 'main p', 'h1', 'p'],
      conditions: [
        bothCondition('document-complete', 'document_ready_state', { expected: 'complete' }),
      ],
    },
    actions: [
      bothAction('settings_patch'),
      bothAction('navigate', { urlId: 'primary' }),
      bothAction('scroll', { maximumSteps: 1, maximumDeltaY: 500 }),
      bothAction('reload', { maximumCount: 1 }),
      bothAction('disable'),
      bothAction('reenable'),
    ],
    observableEffects: {
      candidateSelectors: ['h1', 'p'],
      appliedSelectors: [
        'html[data-friction-text-active="1"] h1',
        'html[data-friction-text-active="1"] p',
        '[data-friction-shuffled="1"]',
      ],
      rootAttributes: [
        'data-friction-text-active',
        'data-friction-text-rhythm',
      ],
      disableCleanup: {
        scope: 'user_settings',
        selectors: [
          'html[data-friction-text-active="1"] h1',
          'html[data-friction-text-active="1"] p',
          '[data-friction-shuffled="1"]',
        ],
        rootAttributes: [
          'data-friction-text-active',
          'data-friction-text-rhythm',
        ],
      },
      conditions: [
        bothCondition('text-root-active', 'root_attributes_present', { minimum: 2 }),
        bothCondition('text-style-changed', 'computed_style_changed', {
          properties: ['filter', 'opacity'],
          compareTo: 'disabled_baseline',
        }),
        diagnosticCondition('text-owner-active', 'debug_path_equals', {
          path: 'effects.textShuffle.active',
          expected: true,
        }),
      ],
    },
    settle: {
      conditions: [
        bothCondition('shuffle-pending-clear', 'root_attribute_absent', {
          attribute: 'data-friction-text-shuffle-pending',
        }),
        diagnosticCondition('text-nodes-settled', 'debug_paths_match', {
          expected: {
            'effects.textShuffle.pendingTextNodeCount': 0,
            'effects.textShuffle.pendingSubtreeCount': 0,
            'effects.textShuffle.pendingSubtreeTaskCount': 0,
          },
        }),
        bothCondition('dom-samples-stable', 'stable_samples', {
          samples: 2,
          intervalMs: 300,
        }),
      ],
    },
    forbiddenActions: [
      ...GLOBAL_FORBIDDEN_ACTIONS,
      'click_external_link',
    ],
    blockerClassifiers: createBlockerClassifiers(),
  }),
];

const ROOT_VISUAL_CONTINUITY_SCENARIOS = [
  defineSiteScenario({
    id: 'youtube-root-visual-continuity',
    suites: ['root-visual-continuity'],
    siteId: 'youtube',
    featureGroup: 'root-visual-continuity',
    execution: createExecution('automated'),
    auth: createAuthMetadata('public_no_login'),
    urls: {
      primary: 'https://www.youtube.com/results?search_query=entropy+qa',
      additional: [],
    },
    allowlistedOrigins: ['https://www.youtube.com'],
    redirectOrigins: [],
    settings: ROOT_VISUAL_CONTINUITY_SETTINGS,
    artifactDisclosureRequirements: createArtifactDisclosureRequirements(['saturation']),
    expectedActivation: createExpectedActivation(ROOT_VISUAL_CONTINUITY_SETTINGS),
    pageRuntimeErrorPolicy: {
      advisorySources: ['network'],
    },
    readiness: {
      selectorMatch: 'any',
      selectors: [
        'ytd-topbar-logo-renderer a[href="/"]',
        'a#logo[href="/"]',
      ],
      conditions: [
        bothCondition('document-complete', 'document_ready_state', { expected: 'complete' }),
      ],
    },
    actions: [
      bothAction('settings_patch'),
      bothAction('root_visual_continuity_probe', {
        probeId: 'youtube-home-link',
        targetSelector: 'ytd-topbar-logo-renderer a[href="/"], a#logo[href="/"]',
        expectedSourcePath: '/results',
        expectedPathPrefix: '/',
        expectedGrayscaleStrength: 0.5,
        maximumCompositorChromaRatio: 0.58,
        routeTimeoutMs: 15_000,
        settleMs: 1_500,
        minimumAnimationFrameCount: 3,
        minimumCompositorFrameCount: 2,
        requiresTrustedGesture: true,
        requiredForEvaluation: true,
      }),
      bothAction('disable'),
      bothAction('reenable'),
    ],
    observableEffects: {
      candidateSelectors: ['html'],
      appliedSelectors: ['html[style*="grayscale"]'],
      rootAttributes: ['data-entropy-prepaint-suppressed'],
      rootAttributeActiveValues: {
        'data-entropy-prepaint-suppressed': '1',
      },
      disableCleanup: {
        scope: 'user_settings',
        selectors: ['html[style*="grayscale"]'],
        rootAttributes: [],
      },
      conditions: [
        bothCondition('root-filter-applied', 'selector_any_applied', { minimum: 1 }),
        bothCondition('prepaint-owner-suppressed', 'root_attributes_present', { minimum: 1 }),
      ],
    },
    settle: {
      conditions: [
        bothCondition('dom-samples-stable', 'stable_samples', {
          samples: 2,
          intervalMs: 400,
        }),
      ],
    },
    forbiddenActions: [
      ...GLOBAL_FORBIDDEN_ACTIONS,
      'like',
      'subscribe',
      'comment',
      'share',
      'click_ad',
      'click_external_link',
    ],
    blockerClassifiers: createBlockerClassifiers(),
  }),
];

function createPublicFeedRuntimeContentionScenario(
  sourceId,
  id,
  { runtimeProfile = 'combined' } = {},
) {
  const source = RELEASE_CORE_SCENARIOS.find((scenario) => scenario.id === sourceId);
  if (!source?.feedConsumption) {
    throw new Error(`SITE_FEED_RUNTIME_SOURCE_REQUIRED:${sourceId}`);
  }
  const settings = RUNTIME_CONTENTION_SETTINGS_BY_PROFILE[runtimeProfile];
  if (!settings) {
    throw new Error(`SITE_FEED_RUNTIME_PROFILE_INVALID:${runtimeProfile}`);
  }
  const activeFeatures = settings.sourceFilterKeys;
  const scrollActive = activeFeatures.includes('scrollFriction');
  const visualActive = activeFeatures.includes('blur');
  const textActive = activeFeatures.includes('textRhythm');
  const pagedScrollIntentActive = scrollActive && source.siteId === 'youtube';
  const rootAttributes = [
    ...(scrollActive ? ['data-scroll-friction-active'] : []),
    ...(visualActive ? ['data-friction-visual'] : []),
    ...(textActive ? ['data-friction-text-active'] : []),
  ];
  const rootAttributeActiveValues = {
    ...(scrollActive ? { 'data-scroll-friction-active': 'active' } : {}),
    ...(visualActive ? { 'data-friction-visual': '1' } : {}),
    ...(textActive ? { 'data-friction-text-active': '1' } : {}),
  };
  const appliedSelectors = [
    ...(scrollActive ? ['html[data-scroll-friction-active="active"]'] : []),
    ...(visualActive ? ['html[data-friction-visual="1"]'] : []),
    ...(textActive ? [
      'html[data-friction-text-active="1"]',
      '[data-friction-shuffled="1"]',
    ] : []),
  ];
  const runtimeActionKinds = new Set([
    'settings_patch',
    'navigate',
    'trusted_wheel',
    'trusted_key_scroll',
    'trusted_touch_swipe',
    'disable',
    'reenable',
  ]);
  return defineSiteScenario({
    ...source,
    id,
    suites: ['feed-runtime-public'],
    featureGroup: `real-feed-runtime-${runtimeProfile}`,
    settings,
    artifactDisclosureRequirements: createArtifactDisclosureRequirements(activeFeatures),
    expectedActivation: createExpectedActivation(settings),
    readiness: {
      selectorMatch: 'any',
      selectors: source.siteId === 'youtube'
        ? ['#shorts-container, #shorts-inner-container']
        : source.readiness.selectors,
      conditions: [
        bothCondition('document-complete', 'document_ready_state', { expected: 'complete' }),
      ],
    },
    actions: source.actions
      .filter((action) => runtimeActionKinds.has(action.kind))
      .map((action) => (
        source.siteId === 'youtube' && action.kind === 'trusted_wheel'
          ? {
            ...action,
            targetSelector: '#shorts-container, #shorts-inner-container',
          }
          : action
      )),
    observableEffects: {
      candidateSelectors: source.observableEffects.candidateSelectors,
      appliedSelectors,
      rootAttributes,
      rootAttributeActiveValues,
      disableCleanup: {
        scope: 'user_settings',
        selectors: appliedSelectors,
        rootAttributes,
      },
      conditions: [
        bothCondition('runtime-profile-root-active', 'root_attributes_present', {
          minimum: rootAttributes.length,
        }),
        ...(scrollActive ? [
          diagnosticCondition('scroll-owner-applied', 'debug_event_seen', {
            feature: 'scrollFriction',
            event: 'manager_apply',
          }),
          ...(pagedScrollIntentActive ? [
            diagnosticCondition('paged-scroll-intents-measured', 'debug_number_at_least', {
              path: 'runtimeContention.scroll.pagedIntentInputCount',
              minimum: 1,
            }),
            diagnosticCondition('paged-scroll-commits-measured', 'debug_number_at_least', {
              path: 'runtimeContention.scroll.pagedCommitCount',
              minimum: 1,
            }),
            diagnosticCondition('paged-scroll-physics-idle', 'debug_path_in', {
              path: 'runtimeContention.scroll.frameCount',
              expected: [0],
            }),
          ] : [
            diagnosticCondition('scroll-frames-measured', 'debug_number_at_least', {
              path: 'runtimeContention.scroll.frameCount',
              minimum: 1,
            }),
            diagnosticCondition('scroll-input-frames-measured', 'debug_number_at_least', {
              path: 'runtimeContention.scroll.inputFrameCount',
              minimum: 1,
            }),
          ]),
        ] : []),
        diagnosticCondition('contention-owner-work-measured', 'debug_number_at_least', {
          path: 'runtimeContention.ownerWork.operationCount',
          minimum: 1,
        }),
      ],
    },
    settle: {
      conditions: [
        ...(textActive ? [
          bothCondition('shuffle-pending-clear', 'root_attribute_absent', {
            attribute: 'data-friction-text-shuffle-pending',
          }),
          diagnosticCondition('text-nodes-settled', 'debug_paths_match', {
            expected: {
              'effects.textShuffle.pendingTextNodeCount': 0,
              'effects.textShuffle.pendingSubtreeCount': 0,
              'effects.textShuffle.pendingSubtreeTaskCount': 0,
            },
          }),
        ] : []),
        ...(visualActive ? [
          diagnosticCondition('media-rechecks-empty', 'debug_path_in', {
            path: 'effects.visual.pendingRecheckCount',
            waitTimeoutMs: 18_000,
            expected: [0],
            unmetState: 'active_pending',
          }),
        ] : []),
        bothCondition('dom-samples-stable', 'stable_samples', {
          samples: 2,
          intervalMs: 400,
        }),
      ],
    },
  });
}

const PUBLIC_FEED_RUNTIME_SCENARIOS = [
  createPublicFeedRuntimeContentionScenario(
    'youtube-shorts-feed-horizon',
    'youtube-shorts-scroll-runtime-contention',
  ),
  createPublicFeedRuntimeContentionScenario(
    'youtube-shorts-feed-horizon',
    'youtube-shorts-scroll-only-runtime-contention',
    { runtimeProfile: 'scroll' },
  ),
  createPublicFeedRuntimeContentionScenario(
    'youtube-shorts-feed-horizon',
    'youtube-shorts-visual-only-runtime-contention',
    { runtimeProfile: 'visual' },
  ),
  createPublicFeedRuntimeContentionScenario(
    'youtube-shorts-feed-horizon',
    'youtube-shorts-text-only-runtime-contention',
    { runtimeProfile: 'text' },
  ),
  createPublicFeedRuntimeContentionScenario(
    'tiktok-public-feed',
    'tiktok-scroll-runtime-contention',
  ),
  createPublicFeedRuntimeContentionScenario(
    'tiktok-public-feed',
    'tiktok-scroll-only-runtime-contention',
    { runtimeProfile: 'scroll' },
  ),
  createPublicFeedRuntimeContentionScenario(
    'tiktok-public-feed',
    'tiktok-visual-only-runtime-contention',
    { runtimeProfile: 'visual' },
  ),
  createPublicFeedRuntimeContentionScenario(
    'tiktok-public-feed',
    'tiktok-text-only-runtime-contention',
    { runtimeProfile: 'text' },
  ),
];

function createYoutubeWatchRuntimeContentionScenario(
  id,
  { runtimeProfile = 'combined' } = {},
) {
  const source = RELEASE_CORE_SCENARIOS.find((scenario) => scenario.id === 'youtube-public-core');
  if (!source) throw new Error('SITE_WATCH_RUNTIME_SOURCE_REQUIRED');
  const settings = WATCH_RUNTIME_SETTINGS_BY_PROFILE[runtimeProfile];
  if (!settings) throw new Error(`SITE_WATCH_RUNTIME_PROFILE_INVALID:${runtimeProfile}`);
  const activeFeatures = settings.sourceFilterKeys;
  const scrollActive = activeFeatures.includes('scrollFriction');
  const visualActive = activeFeatures.includes('blur');
  const textActive = activeFeatures.includes('textRhythm');
  const socialActive = activeFeatures.includes('socialMetrics');
  const rootAttributes = [
    ...(scrollActive ? ['data-scroll-friction-active'] : []),
    ...(visualActive ? ['data-friction-visual'] : []),
    ...(textActive ? ['data-friction-text-active'] : []),
    ...(socialActive ? ['data-friction-social-metrics'] : []),
  ];
  const rootAttributeActiveValues = {
    ...(scrollActive ? { 'data-scroll-friction-active': 'active' } : {}),
    ...(visualActive ? { 'data-friction-visual': '1' } : {}),
    ...(textActive ? { 'data-friction-text-active': '1' } : {}),
    ...(socialActive ? { 'data-friction-social-metrics': '1' } : {}),
  };
  const appliedSelectors = [
    ...(scrollActive ? ['html[data-scroll-friction-active="active"]'] : []),
    ...(visualActive ? ['html[data-friction-visual="1"]'] : []),
    ...(textActive ? [
      'html[data-friction-text-active="1"]',
      '[data-friction-shuffled="1"]',
    ] : []),
    ...(socialActive ? [
      '[data-friction-social-engagement="1"]',
      '[data-friction-social-exposure="1"]',
    ] : []),
  ];
  return defineSiteScenario({
    ...source,
    id,
    suites: ['watch-runtime-public'],
    featureGroup: `watch-runtime-${runtimeProfile}`,
    settings,
    artifactDisclosureRequirements: createArtifactDisclosureRequirements(activeFeatures),
    expectedActivation: createExpectedActivation(settings, socialActive ? {
      activeMetricKeys: ['feedbackCounts', 'viewCounts', 'timeSignals'],
      compiledPlanCount: 2,
    } : {}),
    readiness: {
      selectorMatch: 'any',
      selectors: ['ytd-watch-metadata', '#movie_player video', 'video.html5-main-video'],
      conditions: [
        bothCondition('document-complete', 'document_ready_state', { expected: 'complete' }),
        bothCondition('watch-route', 'url_path_equals', { expected: '/watch' }),
        bothCondition('video-metadata-ready', 'media_ready_state', {
          selector: 'video',
          minimumReadyState: 1,
        }),
      ],
    },
    actions: [
      bothAction('settings_patch'),
      bothAction('trusted_content_load_probe', {
        probeId: 'comments-load',
        opportunitySelectors: [
          'ytd-comment-thread-renderer',
          'ytd-comment-view-model',
        ],
        minimumOpportunityCount: 1,
        maximumSteps: 10,
        deltaY: 900,
        cadenceMs: 180,
        settleMs: 3_000,
        requiresTrustedGesture: true,
        requiredForEvaluation: true,
      }),
      bothAction('disable'),
      bothAction('reenable'),
    ],
    observableEffects: {
      candidateSelectors: [
        'ytd-comment-thread-renderer',
        'ytd-comment-view-model',
        '#vote-count-middle',
        'ytd-video-view-count-renderer span',
      ],
      appliedSelectors,
      rootAttributes,
      rootAttributeActiveValues,
      disableCleanup: {
        scope: 'user_settings',
        selectors: appliedSelectors,
        rootAttributes,
      },
      conditions: [
        bothCondition('runtime-profile-root-active', 'root_attributes_present', {
          minimum: rootAttributes.length,
        }),
        ...(scrollActive ? [
          diagnosticCondition('scroll-owner-applied', 'debug_event_seen', {
            feature: 'scrollFriction',
            event: 'manager_apply',
          }),
          diagnosticCondition('scroll-input-frames-measured', 'debug_number_at_least', {
            path: 'runtimeContention.scroll.inputFrameCount',
            minimum: 1,
          }),
        ] : []),
        ...(socialActive ? [
          bothCondition('social-marker-applied', 'selector_any_applied', { minimum: 1 }),
          diagnosticCondition('social-owner-ready', 'debug_paths_match', {
            expected: {
              'socialMetrics.active': true,
              'socialMetrics.observerAttached': true,
            },
          }),
        ] : []),
        diagnosticCondition('contention-owner-work-measured', 'debug_number_at_least', {
          path: 'runtimeContention.ownerWork.operationCount',
          minimum: 1,
        }),
      ],
    },
    settle: {
      conditions: [
        ...(textActive ? [
          bothCondition('shuffle-pending-clear', 'root_attribute_absent', {
            attribute: 'data-friction-text-shuffle-pending',
          }),
          diagnosticCondition('text-nodes-settled', 'debug_paths_match', {
            expected: {
              'effects.textShuffle.pendingTextNodeCount': 0,
              'effects.textShuffle.pendingSubtreeCount': 0,
              'effects.textShuffle.pendingSubtreeTaskCount': 0,
            },
          }),
        ] : []),
        ...(visualActive ? [
          diagnosticCondition('media-rechecks-empty', 'debug_path_in', {
            path: 'effects.visual.pendingRecheckCount',
            waitTimeoutMs: 18_000,
            expected: [0],
            unmetState: 'active_pending',
          }),
        ] : []),
        ...(socialActive ? createSocialSettleConditions().filter(
          (condition) => condition.id !== 'dom-samples-stable',
        ) : []),
        bothCondition('dom-samples-stable', 'stable_samples', {
          samples: 2,
          intervalMs: 400,
        }),
      ],
    },
  });
}

const YOUTUBE_WATCH_RUNTIME_SCENARIOS = [
  createYoutubeWatchRuntimeContentionScenario('youtube-watch-runtime-combined'),
  createYoutubeWatchRuntimeContentionScenario('youtube-watch-runtime-scroll', {
    runtimeProfile: 'scroll',
  }),
  createYoutubeWatchRuntimeContentionScenario('youtube-watch-runtime-visual', {
    runtimeProfile: 'visual',
  }),
  createYoutubeWatchRuntimeContentionScenario('youtube-watch-runtime-text', {
    runtimeProfile: 'text',
  }),
  createYoutubeWatchRuntimeContentionScenario('youtube-watch-runtime-social', {
    runtimeProfile: 'social',
  }),
];

const RUNTIME_CONTENTION_SCENARIOS = [
  defineSiteScenario({
    id: 'example-scroll-runtime-contention',
    suites: ['runtime-contention'],
    siteId: 'default',
    featureGroup: 'scroll-runtime-contention',
    execution: createExecution('automated'),
    auth: createAuthMetadata('public_no_login'),
    urls: {
      primary: 'https://example.com/',
      additional: [],
    },
    allowlistedOrigins: ['https://example.com'],
    redirectOrigins: [],
    settings: RUNTIME_CONTENTION_SETTINGS,
    artifactDisclosureRequirements: createArtifactDisclosureRequirements([
      'blur',
      'scrollFriction',
      'textRhythm',
    ]),
    expectedActivation: createExpectedActivation(RUNTIME_CONTENTION_SETTINGS),
    readiness: {
      selectorMatch: 'any',
      selectors: ['main h1', 'main p', 'h1', 'p'],
      conditions: [
        bothCondition('document-complete', 'document_ready_state', { expected: 'complete' }),
      ],
    },
    actions: [
      bothAction('settings_patch'),
      bothAction('navigate', { urlId: 'primary' }),
      bothAction('prepare_scroll_contention_fixture', {
        initialRowCount: 32,
        initialSettleMs: 700,
        requiredForEvaluation: true,
      }),
      bothAction('trusted_scroll_probe', {
        probeId: 'single-tick-a',
        targetSelector: '[data-entropy-qa-scroll-lane="a"]',
        deltas: [120],
        cadenceMs: 0,
        settleMs: 900,
        requiresTrustedGesture: true,
        requiredForEvaluation: true,
      }),
      bothAction('trusted_scroll_probe', {
        probeId: 'single-tick-b',
        targetSelector: '[data-entropy-qa-scroll-lane="b"]',
        deltas: [120],
        cadenceMs: 0,
        settleMs: 900,
        requiresTrustedGesture: true,
        requiredForEvaluation: true,
      }),
      bothAction('trusted_scroll_probe', {
        probeId: 'continuous-a',
        targetSelector: '[data-entropy-qa-scroll-lane="a"]',
        deltas: [260, 260, 260, 260, 260],
        cadenceMs: 48,
        settleMs: 1_300,
        contentBurst: {
          afterInputIndex: 1,
          rowCount: 32,
          delayMs: 0,
        },
        requiresTrustedGesture: true,
        requiredForEvaluation: true,
      }),
      bothAction('trusted_scroll_probe', {
        probeId: 'reverse-a',
        targetSelector: '[data-entropy-qa-scroll-lane="a"]',
        deltas: [-180, -180],
        cadenceMs: 80,
        settleMs: 1_000,
        requiresTrustedGesture: true,
        requiredForEvaluation: true,
      }),
      bothAction('trusted_scroll_probe', {
        probeId: 'continuous-b',
        targetSelector: '[data-entropy-qa-scroll-lane="b"]',
        deltas: [260, 260, 260, 260],
        cadenceMs: 48,
        settleMs: 1_300,
        contentBurst: {
          afterInputIndex: 1,
          rowCount: 32,
          delayMs: 0,
        },
        requiresTrustedGesture: true,
        requiredForEvaluation: true,
      }),
      bothAction('disable'),
      bothAction('reenable'),
    ],
    observableEffects: {
      candidateSelectors: [
        'h1',
        'p',
        '[data-entropy-qa-scroll-row]',
        '[data-entropy-qa-scroll-row] img',
      ],
      appliedSelectors: [
        'html[data-scroll-friction-active="active"]',
        'html[data-friction-text-active="1"]',
        '[data-friction-shuffled="1"]',
      ],
      rootAttributes: [
        'data-scroll-friction-active',
        'data-friction-visual',
        'data-friction-text-active',
      ],
      rootAttributeActiveValues: {
        'data-scroll-friction-active': 'active',
        'data-friction-visual': '1',
        'data-friction-text-active': '1',
      },
      disableCleanup: {
        scope: 'user_settings',
        selectors: [
          'html[data-scroll-friction-active="active"]',
          'html[data-friction-text-active="1"]',
          '[data-friction-shuffled="1"]',
        ],
        rootAttributes: [
          'data-scroll-friction-active',
          'data-friction-visual',
          'data-friction-text-active',
        ],
      },
      conditions: [
        bothCondition('scroll-runtime-root-active', 'root_attributes_present', { minimum: 3 }),
        diagnosticCondition('scroll-owner-applied', 'debug_event_seen', {
          feature: 'scrollFriction',
          event: 'manager_apply',
        }),
        diagnosticCondition('scroll-frames-measured', 'debug_number_at_least', {
          path: 'runtimeContention.scroll.frameCount',
          minimum: 1,
        }),
        diagnosticCondition('scroll-input-frames-measured', 'debug_number_at_least', {
          path: 'runtimeContention.scroll.inputFrameCount',
          minimum: 1,
        }),
        diagnosticCondition('contention-owner-work-measured', 'debug_number_at_least', {
          path: 'runtimeContention.ownerWork.operationCount',
          minimum: 1,
        }),
      ],
    },
    settle: {
      conditions: [
        bothCondition('shuffle-pending-clear', 'root_attribute_absent', {
          attribute: 'data-friction-text-shuffle-pending',
        }),
        diagnosticCondition('text-nodes-settled', 'debug_paths_match', {
          expected: {
            'effects.textShuffle.pendingTextNodeCount': 0,
            'effects.textShuffle.pendingSubtreeCount': 0,
            'effects.textShuffle.pendingSubtreeTaskCount': 0,
          },
        }),
        diagnosticCondition('media-rechecks-empty', 'debug_path_in', {
          path: 'effects.visual.pendingRecheckCount',
          waitTimeoutMs: 18_000,
          expected: [0],
          unmetState: 'active_pending',
        }),
        bothCondition('dom-samples-stable', 'stable_samples', {
          samples: 2,
          intervalMs: 400,
        }),
      ],
    },
    forbiddenActions: [
      ...GLOBAL_FORBIDDEN_ACTIONS,
      'click_external_link',
    ],
    blockerClassifiers: createBlockerClassifiers(),
  }),
];

function createAuthenticatedFeedHorizonScenario({
  id,
  siteId,
  url,
  origin,
  surfaceMode,
  capability,
  readinessSelectors,
  oracleSelectors,
  maximumCandidates = 48,
  inputs,
}) {
  const artifactSelectors = [
    '#entropy-feed-terminus',
    '#entropy-feed-endpoint-marker',
    '#entropy-feed-endpoint-tail',
    '#entropy-feed-endpoint-quarantine',
  ];
  return defineSiteScenario({
    id,
    suites: ['feed-horizon-login'],
    siteId,
    featureGroup: `authenticated-${surfaceMode}-feed-flow`,
    execution: createExecution('automated', {
      requiresExplicitQaProfile: true,
    }),
    auth: createAuthMetadata('qa_profile_required'),
    urls: {
      primary: url,
      additional: [],
    },
    allowlistedOrigins: [origin],
    redirectOrigins: [],
    settings: AUTHENTICATED_FEED_HORIZON_SETTINGS,
    artifactDisclosureRequirements: createArtifactDisclosureRequirements(['ensoGate']),
    expectedActivation: createExpectedActivation(AUTHENTICATED_FEED_HORIZON_SETTINGS, {
      runtimeDerivedKeys: ['infiniteScrollGuard'],
    }),
    readiness: {
      selectorMatch: 'any',
      selectors: readinessSelectors,
      conditions: [
        bothCondition('document-complete', 'document_ready_state', { expected: 'complete' }),
        diagnosticCondition(`feed-profile-${siteId}`, 'debug_path_equals', {
          path: 'feedFlow.semantic.readiness.profileId',
          expected: siteId,
        }),
        diagnosticCondition('feed-readiness-ready', 'debug_path_equals', {
          path: 'feedFlow.semantic.readiness.status',
          expected: 'ready',
          evidencePath: 'feedFlow.semantic.readiness',
          minimumFeedOpportunityCount: 2,
        }),
        diagnosticCondition(`feed-capability-${surfaceMode}`, 'debug_path_equals', {
          path: 'feedFlow.semantic.readiness.capability',
          expected: capability,
          evidencePath: 'feedFlow.semantic.readiness',
          minimumFeedOpportunityCount: 2,
        }),
      ],
    },
    feedConsumption: {
      surfaceMode,
      oracle: {
        kind: 'dominant_item',
        selectors: oracleSelectors,
        maximumCandidates,
        minimumProgressRatio: 0.2,
        readinessTimeoutMs: 8_000,
        minimumStableSamples: 2,
      },
    },
    actions: [
      bothAction('settings_patch', { requiresExplicitQaProfile: true }),
      bothAction('navigate', {
        urlId: 'primary',
        requiresExplicitQaProfile: true,
      }),
      ...createPagedTrustedFeedJourney({
        minimumDwellMs: 1_100,
        inputs: inputs.map((input) => ({
          ...input,
          requiresExplicitQaProfile: true,
        })),
      }),
      bothAction('disable', { requiresExplicitQaProfile: true }),
      bothAction('reenable', { requiresExplicitQaProfile: true }),
    ],
    observableEffects: {
      candidateSelectors: readinessSelectors,
      appliedSelectors: artifactSelectors,
      rootAttributes: ['data-enso-gate-active'],
      rootAttributeActiveValues: {
        'data-enso-gate-active': 'active',
      },
      disableCleanup: {
        scope: 'user_settings',
        selectors: artifactSelectors,
        rootAttributes: ['data-enso-gate-active'],
      },
      conditions: [
        diagnosticCondition('feed-transitions-measured', 'debug_counter_increased', {
          paths: [
            'feedFlow.ledger.counters.advanceCount',
            'feedFlow.semantic.metrics.advanceCount',
            'feedFlow.semantic.metrics.itemTransitions',
          ],
          minimum: 1,
        }),
        diagnosticCondition('feed-consumption-exact-match', 'debug_feed_consumption_journey', {
          path: 'feedFlow.ledger',
        }),
        diagnosticCondition('feed-supply-settled', 'debug_path_equals', {
          path: 'feedFlow.readout.pendingStep',
          expected: false,
          evidencePath: 'feedFlow.readout',
        }),
        diagnosticCondition('feed-semantic-pressure-observed', 'debug_path_in', {
          path: 'feedFlow.semantic.state',
          expected: ['pressure', 'interrupt'],
          unmetState: 'armed_idle',
        }),
        diagnosticCondition('feed-horizon-admission-evaluated', 'debug_path_in', {
          path: 'feedFlow.episode.admission.status',
          expected: ['withheld', 'admitted'],
          unmetState: 'unavailable',
          evidencePath: 'feedFlow.episode',
        }),
        bothCondition('feed-horizon-presented', 'selector_any_applied', {
          minimum: 1,
          conditionalOn: 'feedFlow.episode.admission.status=admitted',
        }),
      ],
    },
    settle: {
      conditions: [
        bothCondition('feed-artifacts-clean-after-disable', 'selectors_absent_after_disable', {
          selectors: artifactSelectors,
        }),
        bothCondition('dom-samples-stable', 'stable_samples', {
          samples: 2,
          intervalMs: 500,
        }),
      ],
    },
    forbiddenActions: [
      ...GLOBAL_FORBIDDEN_ACTIONS,
      'like',
      'follow',
      'comment',
      'share',
      'save',
      'click_profile',
    ],
    blockerClassifiers: createBlockerClassifiers({
      authenticatedSuite: true,
    }),
  });
}

const FEED_HORIZON_LOGIN_SCENARIOS = [
  createAuthenticatedFeedHorizonScenario({
    id: 'youtube-home-feed-horizon',
    siteId: 'youtube',
    url: 'https://www.youtube.com/',
    origin: 'https://www.youtube.com',
    surfaceMode: 'continuous',
    capability: 'anchored_continuous',
    readinessSelectors: [
      'ytd-rich-grid-renderer #contents',
      'ytd-rich-grid-renderer #contents '
        + '> ytd-rich-item-renderer:has(yt-lockup-view-model)',
    ],
    oracleSelectors: [
      'ytd-rich-grid-renderer #contents '
        + '> ytd-rich-item-renderer:has(yt-lockup-view-model)',
    ],
    maximumCandidates: 64,
    inputs: Array.from({ length: 7 }, () => ({
      kind: 'trusted_wheel',
      maximumDeltaY: 900,
    })),
  }),
  createAuthenticatedFeedHorizonScenario({
    id: 'x-home-feed-horizon',
    siteId: 'x',
    url: 'https://x.com/home',
    origin: 'https://x.com',
    surfaceMode: 'continuous',
    capability: 'anchored_continuous',
    readinessSelectors: [
      '[data-testid="primaryColumn"]',
      'main article[data-testid="tweet"]',
    ],
    oracleSelectors: ['main article[data-testid="tweet"]'],
    inputs: Array.from({ length: 7 }, () => ({
      kind: 'trusted_wheel',
      maximumDeltaY: 900,
    })),
  }),
  createAuthenticatedFeedHorizonScenario({
    id: 'instagram-home-feed-horizon',
    siteId: 'instagram',
    url: 'https://www.instagram.com/',
    origin: 'https://www.instagram.com',
    surfaceMode: 'continuous',
    capability: 'anchored_continuous',
    readinessSelectors: [
      'main[role="main"]',
      'main[role="main"] article',
    ],
    oracleSelectors: ['main[role="main"] article'],
    inputs: Array.from({ length: 7 }, () => ({
      kind: 'trusted_wheel',
      maximumDeltaY: 900,
    })),
  }),
  createAuthenticatedFeedHorizonScenario({
    id: 'facebook-home-feed-horizon',
    siteId: 'facebook',
    url: 'https://www.facebook.com/',
    origin: 'https://www.facebook.com',
    surfaceMode: 'continuous',
    capability: 'anchored_continuous',
    readinessSelectors: [
      '[role="main"] [role="feed"]',
      '[role="main"] [role="feed"] [role="article"]',
    ],
    oracleSelectors: ['[role="main"] [role="feed"] [role="article"]'],
    inputs: Array.from({ length: 7 }, () => ({
      kind: 'trusted_wheel',
      maximumDeltaY: 900,
    })),
  }),
  createAuthenticatedFeedHorizonScenario({
    id: 'instagram-reels-feed-horizon',
    siteId: 'instagram',
    url: 'https://www.instagram.com/reels/',
    origin: 'https://www.instagram.com',
    surfaceMode: 'paged',
    capability: 'paged_hold',
    readinessSelectors: [
      'main[role="main"] > div:first-child',
      'main[role="main"] > div:first-child > div',
      'main[role="main"] video',
    ],
    oracleSelectors: [
      'main[role="main"] > div:first-child > div',
      'main[role="main"] > div:first-child > div video',
    ],
    maximumCandidates: 32,
    inputs: Array.from({ length: 7 }, () => ({
      kind: 'trusted_wheel',
      targetSelector: 'main[role="main"] > div:first-child',
      maximumDeltaY: 520,
    })),
  }),
];

const TARGETING_CORE_SCENARIOS = [
  createTargetingScenario({
    id: 'example-text-targeting',
    siteId: 'default',
    effect: 'text',
    url: 'https://example.com/',
    origin: 'https://example.com',
    readinessSelectors: ['main h1', 'main p', 'h1', 'p'],
    positiveSelectors: ['h1', 'p'],
    negativeSelectors: [],
    positiveGeometry: {
      minimumWidth: 20,
      minimumHeight: 10,
      minimumArea: 200,
    },
  }),
  createTargetingScenario({
    id: 'youtube-media-targeting',
    membershipProbe: true,
    siteId: 'youtube',
    effect: 'media',
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    origin: 'https://www.youtube.com',
    readinessSelectors: [
      '#movie_player video',
      'video.html5-main-video',
      'ytd-thumbnail img',
    ],
    positiveSelectors: [
      'video.html5-main-video',
      'ytd-thumbnail img[src]',
      'yt-thumbnail-view-model img[src]',
    ],
    negativeSelectors: [
      '#avatar img',
      'yt-img-shadow#avatar img',
      'img[alt*="avatar" i]',
    ],
    positiveGeometry: {
      minimumWidth: 64,
      minimumHeight: 36,
      minimumArea: 2300,
    },
  }),
  createTargetingScenario({
    id: 'youtube-text-targeting',
    siteId: 'youtube',
    effect: 'text',
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    origin: 'https://www.youtube.com',
    readinessSelectors: [
      'h1 yt-formatted-string',
      '#video-title',
      '#description-inline-expander',
    ],
    positiveSelectors: [
      'h1 yt-formatted-string',
      'ytd-rich-grid-media #video-title',
      'ytd-compact-video-renderer #video-title',
    ],
    negativeSelectors: [
      'input',
      'textarea',
      'pre',
      'code',
      '[contenteditable="true"]',
    ],
    positiveGeometry: {
      minimumWidth: 20,
      minimumHeight: 10,
      minimumArea: 200,
    },
  }),
  createTargetingScenario({
    id: 'reddit-media-targeting',
    siteId: 'reddit',
    effect: 'media',
    url: 'https://www.reddit.com/r/popular/',
    origin: 'https://www.reddit.com',
    readinessSelectors: [
      'shreddit-post',
      '[data-testid="post-container"]',
      'article',
    ],
    positiveSelectors: [
      'shreddit-post img',
      'shreddit-post video',
      '[data-testid="post-container"] img',
      'article video',
    ],
    negativeSelectors: [
      'faceplate-avatar img',
      'img[alt*="avatar" i]',
      'img[alt*="profile" i]',
    ],
    positiveGeometry: {
      minimumWidth: 90,
      minimumHeight: 60,
      minimumArea: 6200,
    },
  }),
  createTargetingScenario({
    id: 'reddit-text-targeting',
    siteId: 'reddit',
    effect: 'text',
    url: 'https://www.reddit.com/r/popular/',
    origin: 'https://www.reddit.com',
    readinessSelectors: [
      'shreddit-post',
      '[data-testid="post-container"]',
      'article',
    ],
    positiveSelectors: [
      'shreddit-post h1',
      'shreddit-post h2',
      'shreddit-post h3',
      'shreddit-post p',
      '[data-testid="post-container"] p',
    ],
    negativeSelectors: [
      'input',
      'textarea',
      'pre',
      'code',
      '[contenteditable="true"]',
    ],
    positiveGeometry: {
      minimumWidth: 20,
      minimumHeight: 10,
      minimumArea: 200,
    },
  }),
  createTargetingScenario({
    id: 'tiktok-media-targeting',
    siteId: 'tiktok',
    effect: 'media',
    url: 'https://www.tiktok.com/foryou',
    origin: 'https://www.tiktok.com',
    readinessSelectors: [
      '[data-e2e="recommend-list-item-container"]',
      '[data-e2e*="video-player" i]',
      'video',
    ],
    positiveSelectors: [
      'video',
      'picture img',
      'img[src*="tiktokcdn" i]',
      'img[src*="muscdn" i]',
    ],
    negativeSelectors: [
      '[data-e2e*="avatar" i] img',
      'img[alt*="avatar" i]',
      'img[alt*="profile" i]',
    ],
    positiveGeometry: {
      minimumWidth: 96,
      minimumHeight: 128,
      minimumArea: 9000,
    },
  }),
  createTargetingScenario({
    id: 'tiktok-text-targeting',
    siteId: 'tiktok',
    effect: 'text',
    url: 'https://www.tiktok.com/foryou',
    origin: 'https://www.tiktok.com',
    readinessSelectors: [
      '[data-e2e="video-desc"]',
      '[data-e2e*="video-desc" i]',
      '[data-e2e="recommend-list-item-container"]',
    ],
    positiveSelectors: [
      '[data-e2e="video-desc"]',
    ],
    negativeSelectors: [],
    semanticNegativeControls: [
      {
        kind: SITE_TARGETING_SEMANTIC_NEGATIVE_CONTROL_KINDS.HTML_VIDEO_ELEMENT,
        minimum: 1,
      },
    ],
    positiveGeometry: {
      minimumWidth: 20,
      minimumHeight: 10,
      minimumArea: 200,
    },
  }),
];

const TARGETING_LOGIN_SCENARIOS = [
  createTargetingScenario({
    id: 'x-media-targeting',
    siteId: 'x',
    effect: 'media',
    url: 'https://x.com/home',
    origin: 'https://x.com',
    suite: 'targeting-login',
    qaProfileRequired: true,
    readinessSelectors: ['article', '[data-testid="tweet"]'],
    positiveSelectors: [
      '[data-testid="tweetPhoto"] img',
      '[data-testid="card.wrapper"] img',
      'article video',
      '[data-testid="videoPlayer"] video',
    ],
    negativeSelectors: [
      '[data-testid="UserAvatar-Container"] img',
      'img[alt*="profile" i]',
      'img[alt*="avatar" i]',
    ],
    positiveGeometry: {
      minimumWidth: 88,
      minimumHeight: 60,
      minimumArea: 5000,
    },
  }),
  createTargetingScenario({
    id: 'x-text-targeting',
    siteId: 'x',
    effect: 'text',
    url: 'https://x.com/home',
    origin: 'https://x.com',
    suite: 'targeting-login',
    qaProfileRequired: true,
    readinessSelectors: ['article', '[data-testid="tweet"]'],
    positiveSelectors: [
      '[data-testid="tweetText"]',
      'article div[lang]',
    ],
    negativeSelectors: [
      'input',
      'textarea',
      'pre',
      'code',
      '[contenteditable="true"]',
    ],
    positiveGeometry: {
      minimumWidth: 20,
      minimumHeight: 10,
      minimumArea: 200,
    },
  }),
  createTargetingScenario({
    id: 'instagram-media-targeting',
    siteId: 'instagram',
    effect: 'media',
    url: 'https://www.instagram.com/',
    origin: 'https://www.instagram.com',
    suite: 'targeting-login',
    qaProfileRequired: true,
    readinessSelectors: ['main article', 'article', 'section[role="dialog"]'],
    positiveSelectors: [
      'article img:not([alt*="profile" i]):not([alt*="avatar" i])',
      'article video',
      'section[role="dialog"] video',
    ],
    negativeSelectors: [
      'header img',
      'img[alt*="profile" i]',
      'img[alt*="avatar" i]',
    ],
    positiveGeometry: {
      minimumWidth: 90,
      minimumHeight: 90,
      minimumArea: 6200,
    },
  }),
  createTargetingScenario({
    id: 'instagram-text-targeting',
    siteId: 'instagram',
    effect: 'text',
    url: 'https://www.instagram.com/',
    origin: 'https://www.instagram.com',
    suite: 'targeting-login',
    qaProfileRequired: true,
    readinessSelectors: ['main article', 'article', 'section[role="dialog"]'],
    positiveSelectors: [
      'article span[dir="auto"]',
      'article h1',
      'article h2',
    ],
    negativeSelectors: [
      'input',
      'textarea',
      'pre',
      'code',
      '[contenteditable="true"]',
    ],
    positiveGeometry: {
      minimumWidth: 20,
      minimumHeight: 10,
      minimumArea: 200,
    },
  }),
];

function createLoginMetadataScenario({
  id,
  siteId,
  featureGroup,
  url,
  origin,
  readinessSelectors,
  candidateSelectors,
  settings = LOGIN_SOCIAL_SETTINGS,
  shortFormUrl = null,
  shortFormCandidateSelector =
    'a[href="/reel"], a[href="/reel/"], a[href^="/reel/"], a[href="/reels"], a[href="/reels/"], a[href^="/reels/"]',
  shortFormRedirectPath = '/',
  activeMetricKeys = ['feedbackCounts', 'viewCounts', 'timeSignals'],
}) {
  const shortFormEnabled = typeof shortFormUrl === 'string' && shortFormUrl.length > 0;
  const observableEffects = createSocialObservableEffects([
    ...candidateSelectors,
    ...(shortFormEnabled ? [shortFormCandidateSelector] : []),
  ]);
  if (shortFormEnabled) {
    observableEffects.appliedSelectors.push('[data-friction-shortform-hidden="1"]');
    observableEffects.rootAttributes.push('data-friction-shortform-block');
    observableEffects.conditions.push(
      diagnosticCondition('shortform-owner-applied', 'debug_event_seen', {
        feature: 'shortFormBlock',
        event: 'manager_apply',
      }),
      diagnosticCondition('shortform-target-pruned', 'debug_event_seen', {
        feature: 'shortFormBlock',
        event: 'target_pruned',
      }),
    );
  }

  return defineSiteScenario({
    id,
    suites: ['login-required'],
    siteId,
    featureGroup,
    execution: createExecution('metadata_only'),
    auth: createAuthMetadata('qa_profile_required'),
    urls: {
      primary: url,
      additional: shortFormEnabled ? [shortFormUrl] : [],
    },
    allowlistedOrigins: [origin],
    redirectOrigins: [],
    settings,
    artifactDisclosureRequirements: createArtifactDisclosureRequirements([
      ...(shortFormEnabled ? ['shortFormBlock'] : []),
      'socialMetrics',
    ]),
    expectedActivation: createExpectedActivation(settings, {
      runtimeDerivedKeys: shortFormEnabled ? ['videoSkipGuard'] : [],
      activeMetricKeys,
      compiledPlanCount: 2,
    }),
    readiness: {
      selectorMatch: 'any',
      selectors: readinessSelectors,
      conditions: [
        bothCondition('document-complete', 'document_ready_state', { expected: 'complete' }),
        diagnosticCondition('social-baseline-covered', 'debug_baseline_covered', {
          probeId: 'socialMetrics',
          onMissing: 'rebaseline',
        }),
      ],
    },
    actions: [
      bothAction('takeover_checkpoint', { reason: 'authentication' }),
      bothAction('settings_patch', { requiresExplicitQaProfile: true }),
      ...(shortFormEnabled
        ? [bothAction('navigate', {
            urlId: 'additional:0',
            expectedRedirectPath: shortFormRedirectPath,
            requiresExplicitQaProfile: true,
          })]
        : []),
      bothAction('navigate', { urlId: 'primary', requiresExplicitQaProfile: true }),
      bothAction('scroll', {
        maximumSteps: 3,
        maximumDeltaY: 800,
        requiresExplicitQaProfile: true,
      }),
      bothAction('reload', { maximumCount: 1, requiresExplicitQaProfile: true }),
      bothAction('disable', { requiresExplicitQaProfile: true }),
      bothAction('reenable', { requiresExplicitQaProfile: true }),
    ],
    observableEffects,
    settle: {
      conditions: [
        ...createSocialSettleConditions(),
        ...(shortFormEnabled
          ? [diagnosticCondition(
              'shortform-opportunity-effect-complete',
              'debug_shortform_completeness',
              {
                path: 'shortForm.completeness',
                noOpportunityStatus: 'WARN',
              },
            )]
          : []),
      ],
    },
    forbiddenActions: [
      ...GLOBAL_FORBIDDEN_ACTIONS,
      'like',
      'follow',
      'comment',
      'repost',
      'share',
      'save',
      'click_profile',
      'click_external_link',
    ],
    blockerClassifiers: createBlockerClassifiers({ authenticatedSuite: true }),
  });
}

const LOGIN_REQUIRED_SCENARIOS = [
  createLoginMetadataScenario({
    id: 'x-login-metadata',
    siteId: 'x',
    featureGroup: 'authenticated-social-metadata',
    url: 'https://x.com/home',
    origin: 'https://x.com',
    readinessSelectors: ['article', '[data-testid="tweet"]'],
    candidateSelectors: [
      '[data-testid="like"] span',
      '[data-testid="retweet"] span',
      '[data-testid="viewCount"] span',
      'time[datetime]',
    ],
  }),
  createLoginMetadataScenario({
    id: 'instagram-login-metadata',
    siteId: 'instagram',
    featureGroup: 'authenticated-social-metadata',
    url: 'https://www.instagram.com/',
    origin: 'https://www.instagram.com',
    readinessSelectors: ['main article', 'article', 'section[role="dialog"]'],
    candidateSelectors: [
      'a[href*="/liked_by/"] span',
      'a[href*="/likes/"] span',
      'article section span[dir="auto"]',
      'time[datetime]',
    ],
  }),
  createLoginMetadataScenario({
    id: 'facebook-login-metadata',
    siteId: 'facebook',
    featureGroup: 'authenticated-social-shortform',
    url: 'https://www.facebook.com/',
    origin: 'https://www.facebook.com',
    settings: FACEBOOK_LOGIN_SETTINGS,
    shortFormUrl: 'https://www.facebook.com/reel/',
    readinessSelectors: [
      '[role="article"]',
      '[data-pagelet^="FeedUnit_"]',
      '[aria-posinset][aria-describedby]',
    ],
    candidateSelectors: [
      '[role="article"] [aria-label*="like" i] span',
      '[role="article"] [aria-label*="comment" i] span',
      '[role="article"] [aria-label*="view" i] span',
      'time[datetime]',
    ],
  }),
  createLoginMetadataScenario({
    id: 'tiktok-login-protections',
    siteId: 'tiktok',
    featureGroup: 'authenticated-social-shortform',
    url: 'https://www.tiktok.com/explore',
    origin: 'https://www.tiktok.com',
    settings: TIKTOK_LOGIN_SETTINGS,
    shortFormUrl: 'https://www.tiktok.com/foryou',
    shortFormCandidateSelector:
      'a[data-e2e="nav-foryou"], a[data-e2e="nav-following"], [data-e2e="recommend-list-item-container"]',
    shortFormRedirectPath: '/explore',
    activeMetricKeys: [
      'feedbackCounts',
      'viewCounts',
      'timeSignals',
      'audienceCounts',
    ],
    readinessSelectors: [
      '[data-e2e="explore-item"]',
      '[data-e2e="explore-item-list"]',
      '[data-e2e="nav-explore"]',
    ],
    candidateSelectors: [
      '[data-e2e="explore-card-like-container"]',
      '[data-e2e="like-count"]',
      '[data-e2e="comment-count"]',
      '[data-e2e="favorite-count"]',
      '[data-e2e="share-count"]',
      '[data-e2e="video-views"]',
      '[data-e2e="following-count"]',
      '[data-e2e="followers-count"]',
      '[data-e2e="likes-count"]',
    ],
  }),
];

const scenarios = [
  ...RELEASE_CORE_SCENARIOS,
  ...ROOT_VISUAL_CONTINUITY_SCENARIOS,
  ...PUBLIC_FEED_RUNTIME_SCENARIOS,
  ...YOUTUBE_WATCH_RUNTIME_SCENARIOS,
  ...RUNTIME_CONTENTION_SCENARIOS,
  ...FEED_HORIZON_LOGIN_SCENARIOS,
  ...TARGETING_CORE_SCENARIOS,
  ...TARGETING_LOGIN_SCENARIOS,
  ...LOGIN_REQUIRED_SCENARIOS,
];
validateSiteScenarioCatalog(scenarios);

export const SITE_SCENARIO_AUTH_METADATA = deepFreezeScenarioValue({
  public_no_login: createAuthMetadata('public_no_login'),
  qa_profile_required: createAuthMetadata('qa_profile_required'),
});

export const SITE_SCENARIO_SUITE_METADATA = deepFreezeScenarioValue({
  'release-core': {
    id: 'release-core',
    authMode: 'public_no_login',
    executionMode: 'automated',
    defaultProfilePolicy: 'disposable',
    scenarioIds: RELEASE_CORE_SCENARIOS.map((scenario) => scenario.id),
  },
  'root-visual-continuity': {
    id: 'root-visual-continuity',
    authMode: 'public_no_login',
    executionMode: 'automated',
    defaultProfilePolicy: 'disposable',
    scenarioIds: ROOT_VISUAL_CONTINUITY_SCENARIOS.map((scenario) => scenario.id),
  },
  'feed-runtime-public': {
    id: 'feed-runtime-public',
    authMode: 'public_no_login',
    executionMode: 'automated',
    defaultProfilePolicy: 'disposable',
    scenarioIds: PUBLIC_FEED_RUNTIME_SCENARIOS.map((scenario) => scenario.id),
  },
  'watch-runtime-public': {
    id: 'watch-runtime-public',
    authMode: 'public_no_login',
    executionMode: 'automated',
    defaultProfilePolicy: 'disposable',
    scenarioIds: YOUTUBE_WATCH_RUNTIME_SCENARIOS.map((scenario) => scenario.id),
  },
  'runtime-contention': {
    id: 'runtime-contention',
    authMode: 'public_no_login',
    executionMode: 'automated',
    defaultProfilePolicy: 'disposable',
    scenarioIds: RUNTIME_CONTENTION_SCENARIOS.map((scenario) => scenario.id),
  },
  'feed-horizon-login': {
    id: 'feed-horizon-login',
    authMode: 'qa_profile_required',
    executionMode: 'automated',
    defaultProfilePolicy: 'explicit_qa_profile_only',
    scenarioIds: FEED_HORIZON_LOGIN_SCENARIOS.map((scenario) => scenario.id),
  },
  'targeting-core': {
    id: 'targeting-core',
    authMode: 'public_no_login',
    executionMode: 'automated',
    defaultProfilePolicy: 'disposable',
    scenarioIds: TARGETING_CORE_SCENARIOS.map((scenario) => scenario.id),
  },
  'targeting-login': {
    id: 'targeting-login',
    authMode: 'qa_profile_required',
    executionMode: 'metadata_only',
    defaultProfilePolicy: 'explicit_qa_profile_only',
    scenarioIds: TARGETING_LOGIN_SCENARIOS.map((scenario) => scenario.id),
  },
  'login-required': {
    id: 'login-required',
    authMode: 'qa_profile_required',
    executionMode: 'metadata_only',
    defaultProfilePolicy: 'explicit_qa_profile_only',
    scenarioIds: LOGIN_REQUIRED_SCENARIOS.map((scenario) => scenario.id),
  },
});

export const SITE_SCENARIO_CATALOG = deepFreezeScenarioValue(scenarios);

export const SITE_SCENARIO_BY_ID = deepFreezeScenarioValue(
  Object.fromEntries(SITE_SCENARIO_CATALOG.map((scenario) => [scenario.id, scenario])),
);

export function getSiteScenario(scenarioId) {
  const scenario = SITE_SCENARIO_BY_ID[scenarioId];
  if (!scenario) throw new Error(`SITE_SCENARIO_UNKNOWN:${scenarioId || 'missing'}`);
  return scenario;
}

export function getSiteScenarios({ suite, siteId = null, featureGroup = null } = {}) {
  return selectSiteScenarios(SITE_SCENARIO_CATALOG, {
    suiteId: suite,
    siteId,
    featureGroup,
  });
}

export function getSiteScenarioHostPermissions({
  suite,
  siteId = null,
  featureGroup = null,
} = {}) {
  return collectScenarioHostPermissions(getSiteScenarios({ suite, siteId, featureGroup }));
}

export { buildScenarioSettings };
