// Worker-local execution authority. Never persisted or sent to content; the
// serializable task/revision remains owned by the existing propagation outbox.
export function requireSettingsPropagationContext(value) {
  if (value === null || value === undefined) return null; // Non-settings runtime callers.
  if (!value || typeof value !== 'object'
    || !Number.isSafeInteger(value.taskId) || value.taskId <= 0
    || !(value.commitVersion === null || (Number.isSafeInteger(value.commitVersion) && value.commitVersion >= 0))
    || typeof value.executionId !== 'string' || !value.executionId
    || typeof value.signal?.aborted !== 'boolean'
    || typeof value.signal.addEventListener !== 'function'
    || typeof value.signal.removeEventListener !== 'function') {
    throw new Error('SETTINGS_PROPAGATION_CONTEXT_INVALID');
  }
  return value;
}

export function settingsPropagationDiagnostic(context) {
  if (!context) return {};
  return {
    settingsTaskId: context.taskId,
    settingsCommitVersion: context.commitVersion,
    settingsExecutionId: context.executionId,
  };
}

export function throwIfSettingsPropagationCancelled(context, phase) {
  if (!context?.signal.aborted) return;
  const error = new Error(`SETTINGS_PROPAGATION_SUPERSEDED:${phase}`, { cause: context.signal.reason });
  error.code = 'SETTINGS_PROPAGATION_SUPERSEDED';
  error.phase = phase;
  throw error;
}
