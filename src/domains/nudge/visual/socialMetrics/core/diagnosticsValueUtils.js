const DIAGNOSTIC_TEXT_LIMIT = 96;

export function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function roundMs(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
}

export function compactText(value, limit = DIAGNOSTIC_TEXT_LIMIT) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

export function compactSelector(selector, limit = 120) {
  return compactText(selector, limit);
}
