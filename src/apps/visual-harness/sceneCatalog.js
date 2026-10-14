import {
  VISUAL_CAPTURE_TARGETS,
  VISUAL_SCENE_KINDS,
  assembleVisualScene,
  createVisualSceneContractError,
  defineVisualSceneCatalogEntry,
  toVisualSceneManifest,
} from './visualSceneContract.js';

const VISUAL_SCENE_CATALOG = Object.freeze([
  ...[
    { id: 'desktop', width: 1440, height: 1000 },
    { id: 'mobile', width: 390, height: 844 },
    { id: 'clip', width: 1440, height: 1000 },
    { id: 'dulled', width: 1440, height: 1000 },
    { id: 'ending', width: 390, height: 844 },
  ].map(({ id, width, height }) => defineVisualSceneCatalogEntry({
    id: `feed/shortform-${id}`, title: `Entropy short-form (${id})`,
    kind: VISUAL_SCENE_KINDS.page, locale: 'ko', themeId: '',
    viewport: { width, height, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: id === 'desktop' ? 'no-preference' : 'reduce', colorScheme: 'light' },
    readyTimeoutMs: 60_000,
    captures: [{ name: 'shortform', target: VISUAL_CAPTURE_TARGETS.viewport }],
    sourceModule: './scenes/ShortFormScene.jsx',
  })),
  ...[
    { id: 'desktop', width: 1440, height: 1000 },
    { id: 'mobile', width: 390, height: 844 },
    { id: 'horizon', width: 1440, height: 1000 },
    { id: 'aligned', width: 1440, height: 1000 },
    { id: 'reflection', width: 390, height: 844 },
  ].map(({ id, width, height }) => defineVisualSceneCatalogEntry({
    id: `feed/landing-${id}`, title: `Entropy feed landing (${id})`,
    kind: VISUAL_SCENE_KINDS.page, locale: 'ko', themeId: '',
    viewport: { width, height, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'reduce', colorScheme: 'light' },
    readyTimeoutMs: 60_000,
    captures: [{ name: 'feed', target: VISUAL_CAPTURE_TARGETS.viewport }],
    sourceModule: './scenes/FeedLandingScene.jsx',
  })),
  ...['en-day', 'ko-day', 'en-night', 'ko-night', 'ko-day-motion'].map(variant => defineVisualSceneCatalogEntry({
    id: `zen/type-and-ink-${variant}`, title: `Zen type and ink (${variant})`,
    kind: VISUAL_SCENE_KINDS.component, locale: variant.startsWith('ko') ? 'ko' : 'en', themeId: 'zen',
    viewport: { width: 1280, height: 1660, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: variant.endsWith('-motion') ? 'no-preference' : 'reduce', colorScheme: 'light' },
    readyTimeoutMs: 30_000,
    captures: [{ name: 'type-and-ink', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-zen-type-and-ink]' }],
    sourceModule: './scenes/ZenTypeAndInkScene.jsx',
  })),
  defineVisualSceneCatalogEntry({
    id: 'zen/bonsai-first-bloom', title: 'Zen Bonsai regional first bloom preview',
    kind: VISUAL_SCENE_KINDS.component, locale: 'ko', themeId: 'zen',
    viewport: { width: 1200, height: 900, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'no-preference', colorScheme: 'light' },
    readyTimeoutMs: 60_000,
    captures: [{ name: 'buds', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-visual-capture="bonsai-first-bloom"]' }],
    sourceModule: './scenes/ZenBonsaiFirstBloomScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id:'zen/skip-resistance', title:'Tome Ishi skip resistance feedback', kind:VISUAL_SCENE_KINDS.component,
    locale:'ko', themeId:'zen', viewport:{width:1280,height:800,deviceScaleFactor:1},
    browserPreferences:{reducedMotion:'reduce',colorScheme:'light'}, readyTimeoutMs:30000,
    captures:[{name:'stone',target:VISUAL_CAPTURE_TARGETS.viewport}], sourceModule:'./scenes/SkipResistanceScene.jsx',
  }),
  ...[{id:'zen',themeId:'zen',width:884},{id:'zen-narrow',themeId:'zen',width:390},{id:'matrix',themeId:'matrix',width:884}].map(({id,themeId,width})=>defineVisualSceneCatalogEntry({
    id: 'artifacts/lens-strength-'+id, title: 'Lens independent strength controls ('+id+')',
    kind: VISUAL_SCENE_KINDS.component, locale:'ko', themeId,
    viewport:{width,height:1000,deviceScaleFactor:1}, browserPreferences:{reducedMotion:'reduce',colorScheme:themeId==='zen'?'light':'dark'},
    readyTimeoutMs:30000, captures:[{name:'controls',target:VISUAL_CAPTURE_TARGETS.viewport}], sourceModule:'./scenes/LensStrengthScene.jsx',
  })),
  ...[
    { id: 'zen', themeId: 'zen', width: 884 },
    { id: 'zen-narrow', themeId: 'zen', width: 390 },
    { id: 'matrix', themeId: 'matrix', width: 884 },
  ].map(({ id, themeId, width }) => defineVisualSceneCatalogEntry({
    id: `artifacts/tab-management-${id}`, title: `Barrier tab management controls (${id})`,
    kind: VISUAL_SCENE_KINDS.component, locale: 'ko', themeId,
    viewport: { width, height: 844, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'reduce', colorScheme: themeId === 'zen' ? 'light' : 'dark' },
    readyTimeoutMs: 30_000,
    captures: [{ name: 'controls', target: VISUAL_CAPTURE_TARGETS.viewport }],
    sourceModule: './scenes/BarrierTabManagementScene.jsx',
  })),
  ...['zen', 'matrix', 'entropy', 'cyberpunk', 'clinical', 'scp'].map(themeId => defineVisualSceneCatalogEntry({
    id: `guidance/installation-${themeId}`, title: `First boundary installation (${themeId})`,
    kind: VISUAL_SCENE_KINDS.component, locale: 'ko', themeId,
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'reduce', colorScheme: themeId === 'clinical' || themeId === 'zen' ? 'light' : 'dark' },
    readyTimeoutMs: 30_000,
    captures: [{ name: 'installed', target: VISUAL_CAPTURE_TARGETS.viewport }],
    sourceModule: './scenes/FurinInstallationScene.jsx',
  })),
  defineVisualSceneCatalogEntry({
    id: 'guidance/installation-zen-motion', title: 'First Furin installation visible clock completion',
    kind: VISUAL_SCENE_KINDS.component, locale: 'ko', themeId: 'zen',
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'no-preference', colorScheme: 'light' },
    readyTimeoutMs: 30_000,
    captures: [{ name: 'returned', target: VISUAL_CAPTURE_TARGETS.viewport }],
    sourceModule: './scenes/FurinInstallationScene.jsx',
  }),
  ...[
    { id: 'selected', width: 1280, height: 800, themeId: 'zen' },
    { id: 'start-focused', width: 1280, height: 800, themeId: 'zen' },
    { id: 'narrow', width: 360, height: 740, themeId: 'zen' },
    { id: 'wrapped', width: 1280, height: 800, themeId: 'zen' },
    { id: 'empty', width: 1280, height: 800, themeId: 'zen' },
    { id: 'invalid', width: 360, height: 740, themeId: 'zen' },
    { id: 'matrix', width: 1280, height: 800, themeId: 'matrix' },
    { id: 'options', width: 1280, height: 800, themeId: 'zen' },
    { id: 'options-narrow', width: 390, height: 844, themeId: 'zen' },
  ].map(({ id, width, height, themeId }) => defineVisualSceneCatalogEntry({
    id: `schedule/${id}`, title: `Schedule time editor (${id})`,
    kind: VISUAL_SCENE_KINDS.component, locale: 'ko', themeId,
    viewport: { width, height, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'reduce', colorScheme: themeId === 'zen' ? 'light' : 'dark' },
    readyTimeoutMs: 60_000,
    captures: [{ name: 'workspace', target: VISUAL_CAPTURE_TARGETS.viewport }],
    sourceModule: './scenes/ScheduleEditorScene.jsx',
  })),
  defineVisualSceneCatalogEntry({
    id: 'zen/bonsai-development', title: 'G15 developmental tendency lab D1',
    kind: VISUAL_SCENE_KINDS.component, locale: 'ko', themeId: 'zen',
    viewport: { width: 1500, height: 1120, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'no-preference', colorScheme: 'light' },
    readyTimeoutMs: 60_000,
    captures: [{ name: 'lab', target: VISUAL_CAPTURE_TARGETS.viewport }, { name: 'receipt', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-visual-capture="development-receipt"]' }],
    sourceModule: './scenes/ZenBonsaiDevelopmentScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'zen/bonsai-length-allocation', title: 'G15 D1 length and allocation controls',
    kind: VISUAL_SCENE_KINDS.component, locale: 'ko', themeId: 'zen',
    viewport: { width: 1500, height: 1120, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'no-preference', colorScheme: 'light' },
    readyTimeoutMs: 60_000,
    captures: [{ name: 'lab', target: VISUAL_CAPTURE_TARGETS.viewport }, { name: 'receipt', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-visual-capture="length-receipt"]' }],
    sourceModule: './scenes/ZenBonsaiLengthAllocationScene.jsx',
  }),
  ...[1, 2].map(deviceScaleFactor => defineVisualSceneCatalogEntry({
    id: deviceScaleFactor === 1 ? 'zen/enso-e03' : 'zen/enso-e03-retina',
    title: `Zen Enso E03 open gesture research (DPR ${deviceScaleFactor})`,
    kind: VISUAL_SCENE_KINDS.component, locale: 'ko', themeId: 'zen',
    viewport: { width: 1440, height: 1000, deviceScaleFactor },
    browserPreferences: { reducedMotion: 'no-preference', colorScheme: 'light' }, readyTimeoutMs: 60_000,
    captures: ['overview', 'stages', 'daily', 'results'].map(name => ({ name, target: VISUAL_CAPTURE_TARGETS.selector, selector: `[data-visual-capture="enso-e03-${name}"]` })),
    sourceModule: './scenes/ZenEnsoE03Scene.jsx',
  })),
  ...[1, 2].map(deviceScaleFactor => defineVisualSceneCatalogEntry({
    id: deviceScaleFactor === 1 ? 'zen/enso-e02' : 'zen/enso-e02-retina',
    title: `Zen Enso E02 appearance-preserving execution study (DPR ${deviceScaleFactor})`,
    kind: VISUAL_SCENE_KINDS.component, locale: 'ko', themeId: 'zen',
    viewport: { width: 1440, height: 1000, deviceScaleFactor },
    browserPreferences: { reducedMotion: 'no-preference', colorScheme: 'light' }, readyTimeoutMs: 60_000,
    captures: ['overview', 'stages', 'results'].map(name => ({ name, target: VISUAL_CAPTURE_TARGETS.selector, selector: `[data-visual-capture="enso-e02-${name}"]` })),
    sourceModule: './scenes/ZenEnsoE02Scene.jsx',
  })),
  ...[
    { id: 'records', width: 1280, height: 900, themeId: 'zen' },
    { id: 'records-dark', width: 1280, height: 900, themeId: 'matrix' },
    { id: 'records-narrow', width: 390, height: 1200, themeId: 'zen' },
    { id: 'workspace', width: 1280, height: 1000, themeId: 'zen' },
    { id: 'setup', width: 1280, height: 900, themeId: 'zen' },
    { id: 'setup-custom-narrow', width: 390, height: 1000, themeId: 'zen' },
  ].map(({ id, width, height, themeId }) => defineVisualSceneCatalogEntry({
    id: `settings/${id}`, title: `Settings and usage setup (${id})`,
    kind: VISUAL_SCENE_KINDS.component, locale: 'ko', themeId,
    viewport: { width, height, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'reduce', colorScheme: themeId === 'matrix' ? 'dark' : 'light' },
    readyTimeoutMs: 30_000,
    captures: [{ name: 'surface', target: VISUAL_CAPTURE_TARGETS.viewport }],
    sourceModule: './scenes/SettingsRecordingScene.jsx',
  })),
  ...[1, 2].map(deviceScaleFactor => defineVisualSceneCatalogEntry({
    id: deviceScaleFactor === 1 ? 'zen/enso-research' : 'zen/enso-research-retina',
    title: `Zen Enso independent brush research E01 (DPR ${deviceScaleFactor})`,
    kind: VISUAL_SCENE_KINDS.component, locale: 'ko', themeId: 'zen',
    viewport: { width: 1440, height: 1000, deviceScaleFactor },
    browserPreferences: { reducedMotion: 'no-preference', colorScheme: 'light' }, readyTimeoutMs: 60_000,
    captures: ['overview', 'storyboard', 'daily', 'results'].map(name => ({
      name, target: VISUAL_CAPTURE_TARGETS.selector, selector: `[data-visual-capture="enso-lab-${name}"]`,
    })),
    sourceModule: './scenes/ZenEnsoResearchScene.jsx',
  })),
  ...[1, 2].map((deviceScaleFactor) => defineVisualSceneCatalogEntry({
    id: deviceScaleFactor === 1 ? 'zen/artifact-collection' : 'zen/artifact-collection-retina',
    title: `Zen artifact engine: remaining five scenes (DPR ${deviceScaleFactor})`,
    kind: VISUAL_SCENE_KINDS.component, locale: 'en', themeId: 'zen',
    viewport: { width: 1440, height: 1000, deviceScaleFactor },
    browserPreferences: { reducedMotion: 'no-preference', colorScheme: 'light' }, readyTimeoutMs: 60_000,
    captures: [
      { name: 'comparison', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-visual-capture="collection-comparison"]' },
        { name: 'results', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-visual-capture="collection-results"]' },
        { name: 'furin-armed', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-visual-capture="furin-armed"]' },
      ...['enso-active', 'enso-idle', 'tome-day', 'tome-night', 'lantern-day', 'lantern-night', 'furin-rest', 'furin-back', 'furin-swing', 'furin-impact', 'shishi-fill', 'shishi-tip', 'shishi-dump', 'shishi-return'].flatMap(id => [
        { name: id, target: VISUAL_CAPTURE_TARGETS.selector, selector: `[data-visual-capture="${id}"]` },
        ...['reference', 'candidate'].map(side => ({ name: `${id}-${side}`, target: VISUAL_CAPTURE_TARGETS.selector, selector: `[data-visual-capture="${id}-${side}"]` })),
      ]),
    ],
    sourceModule: './scenes/ZenArtifactCollectionScene.jsx',
  })),
  ...[1, 2].map((deviceScaleFactor) => defineVisualSceneCatalogEntry({
    id: deviceScaleFactor === 1 ? 'zen/artifact-engine' : 'zen/artifact-engine-retina',
    title: `Zen artifact engine: Shoji and GreatWave comparison (DPR ${deviceScaleFactor})`,
    kind: VISUAL_SCENE_KINDS.component,
    locale: 'en',
    themeId: 'zen',
    viewport: { width: 1200, height: 900, deviceScaleFactor },
    browserPreferences: { reducedMotion: 'no-preference', colorScheme: 'light' },
    readyTimeoutMs: 60_000,
    captures: [
      { name: 'comparison', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-visual-capture="engine-comparison"]' },
      { name: 'results', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-visual-capture="engine-results"]' },
      ...['shoji-day', 'shoji-dusk', 'shoji-night', 'shoji-float', 'wave-active', 'wave-idle'].flatMap((id) => [
        { name: id, target: VISUAL_CAPTURE_TARGETS.selector, selector: `[data-visual-capture="${id}"]` },
        ...['reference', 'candidate'].map((side) => ({ name: `${id}-${side}`, target: VISUAL_CAPTURE_TARGETS.selector, selector: `[data-visual-capture="${id}-${side}"]` })),
      ]),
    ],
    sourceModule: './scenes/ZenArtifactEngineScene.jsx',
  })),
  ...['zen', 'matrix'].map((themeId) => defineVisualSceneCatalogEntry({
    id: `sites/daily-cap-${themeId}`,
    title: `Sites daily limit controls (${themeId})`,
    kind: VISUAL_SCENE_KINDS.component,
    locale: 'ko',
    themeId,
    viewport: { width: 1440, height: 4000, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'reduce', colorScheme: themeId === 'zen' ? 'light' : 'dark' },
    readyTimeoutMs: 30_000,
    captures: [
      { name: 'specimens', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-visual-capture="daily-cap-specimens"]' },
      { name: 'workspace', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-visual-capture="daily-cap-workspace"]' },
      ...['narrow', 'empty', 'exception', 'observing', 'long', 'overflow', 'notice', 'protected-only', 'recording-off', 'excluded'].map((scenario) => ({ name: `workspace-${scenario}`, target: VISUAL_CAPTURE_TARGETS.selector, selector: `[data-visual-capture="daily-cap-workspace-${scenario}"]` })),
    ],
    sourceModule: './scenes/SitesDailyCapScene.jsx',
  })),
  ...['zen', 'matrix'].flatMap((themeId) => [false, true].map((narrow) => defineVisualSceneCatalogEntry({
    id: `sites/${narrow ? 'cap-editor-narrow' : 'cap-editors'}-${themeId}`,
    title: `Sites policy editors (${themeId}${narrow ? ', narrow' : ''})`,
    kind: VISUAL_SCENE_KINDS.component, locale: 'ko', themeId,
    viewport: { width: narrow ? 360 : 1440, height: narrow ? 800 : 3200, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'reduce', colorScheme: themeId === 'zen' ? 'light' : 'dark' },
    readyTimeoutMs: 30_000,
    captures: [{ name: 'editors', target: VISUAL_CAPTURE_TARGETS.viewport }],
    sourceModule: './scenes/SitesCapEditorsScene.jsx',
  }))),
  defineVisualSceneCatalogEntry({
    id: 'zen/enso-gate',
    title: 'Barrier consumption boundary sequence',
    kind: VISUAL_SCENE_KINDS.component,
    locale: 'en',
    themeId: 'zen',
    viewport: { width: 1760, height: 1860, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'no-preference', colorScheme: 'light' },
    readyTimeoutMs: 30_000,
    captures: [
      { name: 'sequence', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-visual-capture="enso-sequence"]' },
      { name: 'desktop', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-visual-capture="enso-desktop"]' },
      ...['armed', 'drawing', 'leave-ready', 'enter-ready'].map((id) => ({
        name: id, target: VISUAL_CAPTURE_TARGETS.selector, selector: `[data-visual-capture="enso-${id}"]`,
      })),
    ],
    sourceModule: './scenes/ZenEnsoGateScene.jsx',
  }),
  ...[1, 2].map(deviceScaleFactor => defineVisualSceneCatalogEntry({
    id: deviceScaleFactor === 1 ? 'zen/pressure-dock' : 'zen/pressure-dock-retina',
    title: 'Zen pressure dock safe-area composition',
    kind: VISUAL_SCENE_KINDS.component,
    locale: 'en',
    themeId: 'zen',
    viewport: { width: 1500, height: 900, deviceScaleFactor },
    browserPreferences: { reducedMotion: 'reduce', colorScheme: 'light' },
    // Includes cold source transforms and registered-widget preload, not just paint.
    readyTimeoutMs: 45_000,
    captures: [
      { name: 'specimens', target: VISUAL_CAPTURE_TARGETS.selector, selector: '[data-visual-capture="pressure-dock-specimens"]' },
      ...['wide', 'portrait', 'compact', 'short', 'dominant', 'extreme'].map((id) => ({
        name: id,
        target: VISUAL_CAPTURE_TARGETS.selector,
        selector: `[data-visual-capture="pressure-dock-${id}"]`,
      })),
    ],
    sourceModule: './scenes/ZenPressureDockScene.jsx',
  })),
  defineVisualSceneCatalogEntry({
    id: 'zen/tomeishi',
    title: 'Zen TomeIshi artifact',
    kind: VISUAL_SCENE_KINDS.component,
    locale: 'ko',
    themeId: 'zen',
    viewport: {
      width: 900,
      height: 900,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'no-preference',
      colorScheme: 'light',
    },
    readyTimeoutMs: 15_000,
    captures: [
      {
        name: 'scene',
        target: VISUAL_CAPTURE_TARGETS.selector,
        selector: '[data-visual-capture="tomeishi-scene"]',
      },
      {
        name: 'artifact',
        target: VISUAL_CAPTURE_TARGETS.selector,
        selector: '[data-visual-capture="tomeishi-artifact"]',
      },
    ],
    sourceModule: './scenes/ZenTomeIshiScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'zen/water-lily',
    title: 'Zen water lily bloom',
    kind: VISUAL_SCENE_KINDS.component,
    locale: 'ko',
    themeId: 'zen',
    viewport: {
      width: 1280,
      height: 1000,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'no-preference',
      colorScheme: 'light',
    },
    readyTimeoutMs: 15_000,
    captures: [
      {
        name: 'scene',
        target: VISUAL_CAPTURE_TARGETS.selector,
        selector: '[data-visual-capture="water-lily-scene"]',
      },
      {
        name: 'hero',
        target: VISUAL_CAPTURE_TARGETS.selector,
        selector: '[data-visual-capture="water-lily-hero"]',
      },
      {
        name: 'stages',
        target: VISUAL_CAPTURE_TARGETS.selector,
        selector: '[data-visual-capture="water-lily-grid"]',
      },
      {
        name: 'production-sizes',
        target: VISUAL_CAPTURE_TARGETS.selector,
        selector: '[data-visual-capture="water-lily-production"]',
      },
    ],
    sourceModule: './scenes/ZenWaterLilyScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'sentinel/site-furin-sequence',
    title: 'Site Furin chime sequence',
    kind: VISUAL_SCENE_KINDS.component,
    locale: 'ko',
    themeId: 'zen',
    viewport: {
      width: 1920,
      height: 1740,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'no-preference',
      colorScheme: 'dark',
    },
    readyTimeoutMs: 30_000,
    captures: [
      {
        name: 'sequence',
        target: VISUAL_CAPTURE_TARGETS.selector,
        selector: '[data-visual-capture="site-furin-sequence"]',
      },
      ...['arrival', 'choice', 'breeze', 'narrow'].map((state) => ({
        name: state,
        target: VISUAL_CAPTURE_TARGETS.selector,
        selector: `[data-visual-capture="site-furin-${state}"]`,
      })),
    ],
    sourceModule: './scenes/SiteFurinSequenceScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'sentinel/global-sentinel-sequence',
    title: 'Global Sentinel entry and simulation-break sequence',
    kind: VISUAL_SCENE_KINDS.component,
    locale: 'en',
    themeId: 'zen',
    viewport: {
      width: 1920,
      height: 2040,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'no-preference',
      colorScheme: 'dark',
    },
    // This scene cold-loads the production engine and worker-canvas renderer,
    // then draws a full cinematic filmstrip before readiness. Its cold Vite
    // transform can legitimately exceed the lightweight scene default.
    readyTimeoutMs: 60_000,
    captures: [
      'material-awaiting',
      'material-shadow-detached',
      'material-departure-cruise',
      'material-departure-hold',
      'material-departure-rewind',
      'material-departure-split',
      'material-shadow-departure',
      'material-panel-cascade',
        'material-panel-blow-2',
        'material-panel-blow-3',
        'material-panel-blow-4',
        'material-panel-blow-5',
      'material-false-calm',
      'material-recovery-cover',
      'material-recovery-rewind',
      'material-recovery-wake',
      'material-entry-complete',
      'material-repair-contact',
      'material-contact-release',
      'material-first-front',
      'material-front-arrest',
      'material-second-front',
      'material-front-settled',
      'material-rupture-window',
      'material-miss-seal',
      'material-system-surge',
      'material-hit-3',
      'material-final-decision',
      'material-final-fracture',
      'material-reverse-recall',
      'material-terminal-banish',
      'material-rift-unfold',
      'material-rift-ready',
      'sequence',
      'awaiting',
      'hover',
      'entry-60',
      'entry-160',
      'entry-320',
      'entry-400',
      'entry-520',
      'shadow-detached',
      'departure-cruise',
      'departure-hold',
      'departure-rewind',
      'departure-split',
      'shadow-departure',
      'panel-cascade',
      'blackout',
      'false-calm',
      'recovery-cover',
      'recovery-rewind',
      'recovery-wake',
      'entry-complete',
      'repair-approach',
      'repair-contact',
      'rupture-window',
      'miss-seal',
      'hit-2',
      'system-surge',
      'hit-3',
      'final-decision',
      'final-fracture',
      'reverse-recall',
      'repair-seam-annulment',
      'terminal-ma',
      'terminal-banish',
      'rift-unfold',
      'rift-ready',
      'failure-resync-closure'
    ].map((name) => ({
      name,
      target: VISUAL_CAPTURE_TARGETS.selector,
      selector: `[data-visual-capture="global-sentinel-${name}"]`,
    })),
    sourceModule: './scenes/GlobalSentinelSequenceScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'sentinel/global-sentinel-rift-entry',
    title: 'Global Sentinel post-success rift entry',
    kind: VISUAL_SCENE_KINDS.component,
    locale: 'ko',
    themeId: 'zen',
    viewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'no-preference',
      colorScheme: 'light',
    },
    readyTimeoutMs: 60_000,
    captures: [
      {
        name: 'scene',
        target: VISUAL_CAPTURE_TARGETS.viewport,
      },
      {
        name: 'aperture',
        target: VISUAL_CAPTURE_TARGETS.selector,
        selector: '[data-visual-capture="global-sentinel-rift-aperture"]',
      },
    ],
    sourceModule: './scenes/GlobalSentinelRiftEntryScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'sentinel/room-478-sequence',
    title: 'Room 478 rift traversal and guided breath sequence',
    kind: VISUAL_SCENE_KINDS.component,
    locale: 'ko',
    themeId: 'zen',
    viewport: {
      width: 1920,
      height: 2280,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'no-preference',
      colorScheme: 'dark',
    },
    readyTimeoutMs: 60_000,
    captures: [
      {
        name: 'sequence',
        target: VISUAL_CAPTURE_TARGETS.selector,
        selector: '[data-visual-capture="room478-sequence"]',
      },
      ...[
        'threshold',
        'traverse',
        'fold',
        'room-open',
        'inhale',
        'hold',
        'exhale',
        'still',
      ].map((state) => ({
        name: state,
        target: VISUAL_CAPTURE_TARGETS.selector,
        selector: `[data-visual-capture="room478-${state}"]`,
      })),
    ],
    sourceModule: './scenes/Room478SequenceScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'sentinel/room-478-mobile',
    title: 'Room 478 mobile exhale state',
    kind: VISUAL_SCENE_KINDS.component,
    locale: 'ko',
    themeId: 'zen',
    viewport: {
      width: 430,
      height: 900,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'no-preference',
      colorScheme: 'dark',
    },
    readyTimeoutMs: 60_000,
    captures: [
      {
        name: 'mobile',
        target: VISUAL_CAPTURE_TARGETS.viewport,
      },
    ],
    sourceModule: './scenes/Room478MobileScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'popup/protected',
    title: 'Protected-site popup page',
    kind: VISUAL_SCENE_KINDS.page,
    locale: 'en',
    themeId: '',
    viewport: {
      width: 520,
      height: 360,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'reduce',
      colorScheme: 'light',
    },
    readyTimeoutMs: 10_000,
    captures: [
      {
        name: 'page',
        target: VISUAL_CAPTURE_TARGETS.viewport,
      },
    ],
    sourceModule: './scenes/PopupProtectedScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'popup/protected-ko',
    title: 'Popup protected-ko',
    kind: VISUAL_SCENE_KINDS.page,
    locale: 'ko',
    themeId: '',
    viewport: {
      width: 520,
      height: 360,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'reduce',
      colorScheme: 'light',
    },
    // Includes cold Vite navigation; this is a render fixture, not a popup boot budget.
    readyTimeoutMs: 30_000,
    captures: [
      {
        name: 'page',
        target: VISUAL_CAPTURE_TARGETS.viewport,
      },
    ],
    sourceModule: './scenes/PopupProtectedScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'popup/effects-ko',
    title: 'Popup effects-ko',
    kind: VISUAL_SCENE_KINDS.page,
    locale: 'ko',
    themeId: '',
    viewport: {
      width: 520,
      height: 360,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'reduce',
      colorScheme: 'light',
    },
    // Includes cold Vite navigation; this is a render fixture, not a popup boot budget.
    readyTimeoutMs: 30_000,
    captures: [
      {
        name: 'page',
        target: VISUAL_CAPTURE_TARGETS.viewport,
      },
    ],
    sourceModule: './scenes/PopupProtectedScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'popup/isolation-ko',
    title: 'Popup isolation-ko',
    kind: VISUAL_SCENE_KINDS.page,
    locale: 'ko',
    themeId: '',
    viewport: {
      width: 520,
      height: 360,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'reduce',
      colorScheme: 'light',
    },
    // Includes cold Vite navigation; this is a render fixture, not a popup boot budget.
    readyTimeoutMs: 30_000,
    captures: [
      {
        name: 'page',
        target: VISUAL_CAPTURE_TARGETS.viewport,
      },
    ],
    sourceModule: './scenes/PopupProtectedScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'gate/isolation-boundary',
    title: 'Isolation boundary gate',
    kind: VISUAL_SCENE_KINDS.page,
    locale: 'en',
    themeId: 'zen',
    viewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'reduce',
      colorScheme: 'dark',
    },
    readyTimeoutMs: 10_000,
    captures: [
      {
        name: 'page',
        target: VISUAL_CAPTURE_TARGETS.viewport,
      },
    ],
    sourceModule: './scenes/GateIsolationBoundaryScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'gate/detour-spread',
    title: 'Protected-tab detour gate',
    kind: VISUAL_SCENE_KINDS.page,
    locale: 'en',
    themeId: 'zen',
    viewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'reduce',
      colorScheme: 'dark',
    },
    readyTimeoutMs: 60_000,
    captures: [
      {
        name: 'page',
        target: VISUAL_CAPTURE_TARGETS.viewport,
      },
    ],
    sourceModule: './scenes/GateDetourSpreadScene.jsx',
  }),
  ...[
    { id: 'gate/detour-spread-selected', title: 'White Night selected fragments', width: 1440, height: 900, scene: 'selected' },
    { id: 'gate/detour-spread-first-use', title: 'Branch pruning first selection', width: 1440, height: 900, scene: 'firstUse' },
    { id: 'gate/detour-spread-first-use-ready', title: 'Branch pruning first completion', width: 1440, height: 900, scene: 'firstUseReady' },
    { id: 'gate/detour-spread-first-use-narrow', title: 'Branch pruning narrow first completion', width: 390, height: 844, scene: 'firstUseReady' },
    { id: 'gate/detour-spread-narrow', title: 'White Night narrow selection', width: 390, height: 844, scene: 'selected' },
    { id: 'gate/detour-spread-transfer', title: 'White Night tab in flight', width: 1440, height: 900, scene: 'transfer' },
  ].map(({ id, title, width, height, scene }) => defineVisualSceneCatalogEntry({
    id, title, kind: VISUAL_SCENE_KINDS.page, locale: 'ko', themeId: 'zen',
    viewport: { width, height, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'no-preference', colorScheme: 'dark' },
    readyTimeoutMs: 60_000,
    captures: [{ name: 'page', target: VISUAL_CAPTURE_TARGETS.viewport }],
    sourceModule: './scenes/GateDetourSpreadDesignScenes.jsx',
    sourceExport: scene,
  })),
  ...[
    { id: 'gate/detour-spread-opening', title: 'Branch pruning sudden void reveal', width: 1440, height: 900 },
    { id: 'gate/detour-spread-opening-narrow', title: 'Branch pruning narrow void reveal', width: 390, height: 844 },
  ].map(({ id, title, width, height }) => defineVisualSceneCatalogEntry({
    id, title, kind: VISUAL_SCENE_KINDS.page, locale: 'ko', themeId: 'zen',
    viewport: { width, height, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'no-preference', colorScheme: 'dark' },
    readyTimeoutMs: 60_000,
    captures: [{ name: 'page', target: VISUAL_CAPTURE_TARGETS.viewport }],
    sourceModule: './scenes/GateDetourSpreadClosingScene.jsx', sourceExport: 'opening',
  })),
  defineVisualSceneCatalogEntry({
    id: 'gate/detour-spread-closing-narrow',
    title: 'Branch pruning narrow void consumption',
    kind: VISUAL_SCENE_KINDS.page,
    locale: 'en',
    themeId: 'zen',
    viewport: { width: 390, height: 844, deviceScaleFactor: 1 },
    browserPreferences: { reducedMotion: 'no-preference', colorScheme: 'dark' },
    readyTimeoutMs: 60_000,
    captures: [{ name: 'page', target: VISUAL_CAPTURE_TARGETS.viewport }],
    sourceModule: './scenes/GateDetourSpreadClosingScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'gate/detour-spread-closing',
    title: 'Protected-tab detour horizon closing',
    kind: VISUAL_SCENE_KINDS.page,
    locale: 'en',
    themeId: 'zen',
    viewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'no-preference',
      colorScheme: 'dark',
    },
    readyTimeoutMs: 60_000,
    captures: [
      {
        name: 'page',
        target: VISUAL_CAPTURE_TARGETS.viewport,
      },
    ],
    sourceModule: './scenes/GateDetourSpreadClosingScene.jsx',
  }),
  defineVisualSceneCatalogEntry({
    id: 'gate/detour-spread-ember',
    title: 'Protected-tab detour horizon closed',
    kind: VISUAL_SCENE_KINDS.page,
    locale: 'en',
    themeId: 'zen',
    viewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
    },
    browserPreferences: {
      reducedMotion: 'no-preference',
      colorScheme: 'dark',
    },
    readyTimeoutMs: 60_000,
    captures: [
      {
        name: 'page',
        target: VISUAL_CAPTURE_TARGETS.viewport,
      },
    ],
    sourceModule: './scenes/GateDetourSpreadEmberScene.jsx',
  }),
]);

const VISUAL_SCENE_BY_ID = (() => {
  const result = new Map();
  VISUAL_SCENE_CATALOG.forEach((entry) => {
    if (result.has(entry.id)) {
      throw createVisualSceneContractError(
        '[VisualHarness] scene catalog contains a duplicate id.',
        { sceneId: entry.id },
      );
    }
    result.set(entry.id, entry);
  });
  return result;
})();

function resolveSceneId(sceneId) {
  if (typeof sceneId !== 'string' || !sceneId.trim()) {
    throw createVisualSceneContractError(
      '[VisualHarness] a scene id is required.',
      { sceneId },
    );
  }
  return sceneId.trim();
}

function getVisualSceneEntry(sceneId) {
  const normalizedSceneId = resolveSceneId(sceneId);
  const entry = VISUAL_SCENE_BY_ID.get(normalizedSceneId);
  if (!entry) {
    const error = new Error(`[VisualHarness] unknown scene '${normalizedSceneId}'.`);
    error.code = 'VISUAL_SCENE_UNKNOWN';
    error.details = {
      sceneId: normalizedSceneId,
      availableSceneIds: [...VISUAL_SCENE_BY_ID.keys()],
    };
    throw error;
  }
  return entry;
}

export function listVisualSceneManifests() {
  return VISUAL_SCENE_CATALOG.map((entry) => toVisualSceneManifest(entry));
}

export function getVisualSceneManifest(sceneId) {
  return toVisualSceneManifest(getVisualSceneEntry(sceneId));
}

// Source admission is selected by this same catalog; browser entries never load
// the full catalog or accept a query-driven module path.
export function getVisualSceneSource(sceneId) {
  const entry = getVisualSceneEntry(sceneId);
  return Object.freeze({
    manifest: toVisualSceneManifest(entry),
    sourceModule: entry.sourceModule,
    sourceExport: entry.sourceExport,
  });
}

export async function loadVisualScene(sceneId) {
  const entry = getVisualSceneEntry(sceneId);
  // Node discovery/test API. Vite's browser graph receives one literal import
  // from the finite server instead of traversing every catalog implementation.
  const sceneModule = await import(/* @vite-ignore */ entry.sourceModule);
  return assembleVisualScene(entry, sceneModule[entry.sourceExport]);
}
