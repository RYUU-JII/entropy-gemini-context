// Expectations describe product relationships, independent of the model formula.
// These are visible development cases, never a held-out human accuracy set.
export const CONSUMPTION_SCENARIOS = Object.freeze([
  { id: 'fresh_30', steps: [['protected_use', 30]] },
  { id: 'continuous_60', steps: [['protected_use', 60]] },
  { id: '30_outside_5_30', steps: [['protected_use', 30], ['outside', 5], ['protected_use', 30]] },
  { id: '30_outside_30_30', steps: [['protected_use', 30], ['outside', 30], ['protected_use', 30]] },
  { id: '30_outside_60', steps: [['protected_use', 30], ['outside', 60]] },
  { id: 'repeated_10_2', steps: Array.from({ length: 6 }, () => [['protected_use', 10], ['outside', 2]]).flat() },
  { id: 'rapid_domain_switches', steps: Array.from({ length: 120 }, () => ['protected_use', 0.5]) },
  { id: 'tiny_visit_after_break', steps: [['protected_use', 30], ['outside', 20], ['protected_use', 1 / 60]] },
  { id: 'background_media', steps: [['protected_use', 30], ['protected_media', 5], ['protected_use', 30]] },
  { id: 'unknown_five_minutes', steps: [['protected_use', 30], ['unknown', 5], ['protected_use', 30]] },
  { id: 'missing_overnight', steps: [['protected_use', 60], ['unknown', 8 * 60]] },
  { id: 'intervention_wait', steps: [['protected_use', 30], ['intervention', 5]] },
  { id: 'collection_disabled', steps: [['protected_use', 30], ['disabled', 30]] },
  { id: 'steady_low_duty', steps: Array.from({ length: 30 }, () => [['protected_use', 1], ['outside', 9]]).flat() },
  { id: 'long_saturation_then_break', steps: [['protected_use', 8 * 60], ['outside', 30]] },
]);

export function scenarioPattern(scenario) {
  let at = 0;
  const intervals = scenario.steps.map(([kind, minutes], index) => {
    const startedAt = at;
    at += Math.round(minutes * 60_000);
    return { epoch: `scenario:${scenario.id}`, sequence: index + 1, startedAt, endedAt: at, kind, tab: index % 8, domain: index % 4 };
  });
  return { id: scenario.id, intervals, durationMs: at };
}

export function checkScenarioRelationships(results) {
  const get = (id) => results.find((entry) => entry.id === id);
  const pressure = (id) => get(id).final.memory;
  const checks = [
    ['short break preserves some earlier use', pressure('30_outside_5_30') > pressure('fresh_30')],
    ['short break gives partial relief', pressure('30_outside_5_30') < pressure('continuous_60')],
    ['longer break gives more relief', pressure('30_outside_30_30') < pressure('30_outside_5_30')],
    ['tab churn does not add or erase use', Math.abs(pressure('rapid_domain_switches') - pressure('continuous_60')) < 1e-10],
    ['known background media prevents outside relief', pressure('background_media') > pressure('30_outside_5_30')],
    ['unknown ages more slowly than observed outside', pressure('unknown_five_minutes') > pressure('30_outside_5_30')],
    ['forced waiting neither adds use nor grants outside relief', Math.abs(pressure('intervention_wait') - pressure('fresh_30')) < 1e-10],
    ['repeated brief visits are retained', pressure('repeated_10_2') > 0.35],
    ['tiny return does not undo a meaningful departure', pressure('tiny_visit_after_break') < 0.25],
    ['long departure leaves a light memory', pressure('30_outside_60') < 0.02],
    ['overnight missing data is never certified as rest', get('missing_overnight').final.coverage.status === 'unknown'],
    ['disabled collection cannot request adaptive escalation', get('collection_disabled').level.status === 'baseline'],
    ['saturation does not create unbounded repayment debt', pressure('long_saturation_then_break') < 0.15],
    ['low duty use remains light', pressure('steady_low_duty') < 0.15],
  ];
  return checks.map(([name, passed]) => ({ name, passed }));
}
