// Copy only: admission is decided by the settings domain, never by a widget.
export function sitesRecordingLabel(recording, t) {
  const labels = { recording: t('recording.active'), mode_off: t('recording.off'), consent_required: t('recording.consent_required'), excluded: t('recording.excluded'), outside_scope: t('recording.outside_scope') };
  if (!recording || !Object.hasOwn(labels, recording.reason)) throw new Error('SITES_RECORDING_STATE_REQUIRED');
  return labels[recording.reason];
}
export function sitesRecordingScopeLabel(recording, t) {
  const labels = { all_sites: t('recording.scope_all'), protected_sites: t('recording.scope_protected'), off: sitesRecordingLabel(recording, t) };
  if (!Object.hasOwn(labels, recording.effectiveScope)) throw new Error('SITES_RECORDING_SCOPE_REQUIRED');
  return labels[recording.effectiveScope];
}
