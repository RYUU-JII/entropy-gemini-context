const reportedSoundDiagnosticKeys = new Set();

function normalizeDiagnosticCode(code) {
  const normalized = typeof code === 'string' ? code.trim() : '';
  return normalized || 'sound_runtime_diagnostic';
}

function formatDiagnosticValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return String(value?.message || value);
}

function formatSoundRuntimeDiagnostic(diagnostic) {
  const details = Object.entries(diagnostic)
    .filter(([key]) => key !== 'code')
    .map(([key, value]) => {
      const formattedValue = formatDiagnosticValue(value);
      return formattedValue ? `${key}=${formattedValue}` : '';
    })
    .filter(Boolean)
    .join(' ');
  return details
    ? `[entropy sound] ${diagnostic.code} ${details}`
    : `[entropy sound] ${diagnostic.code}`;
}

export function resetSoundRuntimeDiagnosticsForTests() {
  reportedSoundDiagnosticKeys.clear();
}

export function reportSoundRuntimeDiagnostic({
  code,
  cueId = '',
  sceneId = '',
  themeId = '',
  assetPath = '',
  src = '',
  reason = '',
  error = null,
  consoleRef = console,
  once = true,
} = {}) {
  const diagnostic = {
    code: normalizeDiagnosticCode(code),
  };
  if (cueId) diagnostic.cueId = cueId;
  if (sceneId) diagnostic.sceneId = sceneId;
  if (themeId) diagnostic.themeId = themeId;
  if (assetPath) diagnostic.assetPath = String(assetPath);
  if (src) diagnostic.src = String(src);
  if (reason) diagnostic.reason = String(reason);
  if (error) diagnostic.error = String(error?.message || error);

  const key = JSON.stringify(diagnostic);
  if (once && reportedSoundDiagnosticKeys.has(key)) {
    return diagnostic;
  }
  reportedSoundDiagnosticKeys.add(key);

  if (consoleRef && typeof consoleRef.warn === 'function') {
    consoleRef.warn(formatSoundRuntimeDiagnostic(diagnostic));
  }
  return diagnostic;
}
