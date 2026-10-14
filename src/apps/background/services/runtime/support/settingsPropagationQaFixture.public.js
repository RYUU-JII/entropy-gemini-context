// Shipping composition has no fault controller or QA route dependency.
export function createSettingsPropagationQaFixture({ broadcastSettingsUpdate }) {
  return { broadcastSettingsUpdate };
}
