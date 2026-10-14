export const COOLING_CURVE_PRESETS = Object.freeze({
  gentle: Object.freeze({ startPercent: 35, acceleration: 140 }),
  standard: Object.freeze({ startPercent: 22, acceleration: 100 }),
  steep: Object.freeze({ startPercent: 12, acceleration: 75 }),
});

export const COOLING_CURVE_SLOTS = Object.freeze({
  tint: Object.freeze({ onset: 0, full: 0.231 }),
  signal: Object.freeze({ onset: 0.256, full: 0.436 }),
  blur: Object.freeze({ onset: 0.462, full: 0.641 }),
  pace: Object.freeze({ onset: 0.462, full: 0.641 }),
  text: Object.freeze({ onset: 0.692, full: 0.846 }),
});
export const COOLING_CURVE_FINAL_APPROACH = Object.freeze({ onset: 0.923 });
export const COOLING_CURVE_STEPS = 16;
export const COOLING_CURVE_INTENSITY_FORMS = Object.freeze(['strength_scale', 'binary_onset', 'band']);
