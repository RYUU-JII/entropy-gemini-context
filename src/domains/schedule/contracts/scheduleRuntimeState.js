export const SCHEDULE_RUNTIME_CHANGED = 'SCHEDULE_RUNTIME_CHANGED';

export function requireScheduleRuntimeState(state) {
  if (!state || !['protected', 'relaxation', 'isolation'].includes(state.mode)
    || !['base', 'schedule', 'manual'].includes(state.source)
    || typeof state.capExceeded !== 'boolean'
    || (state.mode === 'protected' ? state.source !== 'base' : state.source === 'base')
    || (state.source === 'manual' && state.mode !== 'isolation')
    || (state.mode !== 'protected' && (typeof state.sessionId !== 'string' || !state.sessionId
      || !Number.isFinite(state.startedAt) || !Number.isFinite(state.endsAt) || state.endsAt <= state.startedAt))
    || typeof state.isolationSession?.active !== 'boolean'
    || state.isolationSession.active !== (state.mode === 'isolation')) {
    throw new Error('SCHEDULE_RUNTIME_RESPONSE_INVALID');
  }
  return state;
}
