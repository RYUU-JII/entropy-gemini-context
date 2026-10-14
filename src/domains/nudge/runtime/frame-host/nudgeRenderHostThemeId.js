import { normalizeNudgeRuntimeContext } from '../nudgeRuntimeContext.js';

function hasThemeCandidate(value) {
  if (typeof value === 'string') return Boolean(value.trim());
  return value !== undefined && value !== null;
}

export function resolveNudgeRenderHostThemeId(payload = {}) {
  const candidates = [
    payload?.runtimeContext?.themeId,
    payload?.themeId,
    payload?.config?.visualThemeId,
  ];
  const candidate = candidates.find(hasThemeCandidate);
  return normalizeNudgeRuntimeContext({ themeId: candidate }).themeId;
}

export default resolveNudgeRenderHostThemeId;
