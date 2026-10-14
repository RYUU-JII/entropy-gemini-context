const freeze = (value) => Object.freeze(value);

export const MAIN_PRESENTATION_SCENE_KINDS = freeze({
  CURRENT: 'current',
  FIRST_VISION: 'first_vision',
});

export const MAIN_PRESENTATION_PHASES = freeze({
  RESOLVING: 'resolving',
  PREPARING_FIRST_VISION: 'preparing_first_vision',
  FIRST_VISION_COMMITTED: 'first_vision_committed',
  PRESENTING: 'presenting',
  COVERING: 'covering',
  PREPARING_CURRENT: 'preparing_current',
  CURRENT_COMMITTED: 'current_committed',
  UNCOVERING: 'uncovering',
  SETTLED: 'settled',
  DEFERRED: 'deferred',
});

export const MAIN_PRESENTATION_TIME_SCOPE_MODES = freeze({
  CURRENT_CYCLE: 'current_cycle',
  FIRST_INSTALL_IDEAL: 'first_install_ideal',
});
