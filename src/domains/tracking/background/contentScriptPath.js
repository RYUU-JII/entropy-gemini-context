function normalizeManagedContentScriptFile(file) {
  if (typeof file !== 'string') return null;
  let normalized = file.trim();
  if (!normalized) return null;

  try {
    if (normalized.startsWith('chrome-extension://') || normalized.startsWith('moz-extension://')) {
      normalized = new URL(normalized).pathname || normalized;
    }
  } catch (_) {
    // Keep original value if URL parsing fails.
  }

  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  normalized = normalized.replace(/^\/+/, '');
  return normalized || null;
}

export function normalizeManagedContentScriptFiles(files) {
  if (!Array.isArray(files) || files.length === 0) return [];
  const unique = new Set();
  const normalized = [];
  files.forEach((file) => {
    const value = normalizeManagedContentScriptFile(file);
    if (!value || unique.has(value)) return;
    unique.add(value);
    normalized.push(value);
  });
  return normalized;
}
