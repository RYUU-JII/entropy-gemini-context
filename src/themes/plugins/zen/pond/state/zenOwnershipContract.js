export const ZEN_SIGNAL_SCANNER_OWNERSHIP = Object.freeze({
    settings: Object.freeze({
        owner: 'useZenSettingsStore',
        fields: Object.freeze([
            'tuning',
            'siteKoiColorStrategy',
            'visualProfile',
        ]),
    }),
    appearance: Object.freeze({
        owner: 'zenAppearanceRepository (useZenAppearanceStore projection)',
        fields: Object.freeze([
            'domainAppearanceMap',
        ]),
    }),
    session: Object.freeze({
        owner: 'useZenSessionStore',
        fields: Object.freeze([
            'sceneGenerationKey',
            'hardResetToken',
            'hardResetStatus',
            'hardResetError',
            'sceneRerollRevision',
        ]),
    }),
    interaction: Object.freeze({
        owner: 'useZenInteractionStore',
        fields: Object.freeze([
            'lockedTarget',
            'hoveredDomain',
            'externalHoverDomain',
            'selectedFishUid',
        ]),
    }),
    roster: Object.freeze({
        owner: 'domainCandidates source + buildZenKoiRosterFrame projection',
        fields: Object.freeze([
            'domainCandidates',
            'presentationMode',
            'koiRosterFrame',
        ]),
    }),
    rosterMemory: Object.freeze({
        owner: 'zenRosterRepository',
        fields: Object.freeze([
            'koiRosterMemory',
        ]),
    }),
    bonsaiScene: Object.freeze({
        owner: 'useZenBonsaiSceneStore',
        fields: Object.freeze([
            'pondBioticSignal',
        ]),
    }),
    runtime: Object.freeze({
        owner: 'zenPondRenderer.worker runtimeState',
        fields: Object.freeze([
            'pointerInputRef',
            'fishRef',
            'activityProfileByDomainRef',
            'surfaceDisturbancesRef',
            'surfaceDisturbanceTelemetryRef',
            'surfaceDisturbanceEventsRef',
            'lilyPadsRef',
            'waterLilyRef',
            'particlesRef',
            'petalsRef',
            'glimmersRef',
            'rocksRef',
            'scene',
            'runtimeLoop',
        ]),
    }),
});

export const ZEN_SIGNAL_SCANNER_BOUNDARY_RULES = Object.freeze([
    'UI emits intent only',
    'Main thread owns business state',
    'Worker owns frame simulation state',
    'Main->Worker uses commands',
    'Worker->Main uses events',
    'Do not use window CustomEvent as state ownership boundary',
]);
