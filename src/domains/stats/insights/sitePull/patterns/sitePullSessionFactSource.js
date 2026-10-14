const PLAIN_OBJECT_PROTOTYPE = Object.prototype;

function isObjectRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isObjectRecord(value) && PLAIN_OBJECT_PROTOTYPE.hasOwnProperty.call(value, key);
}

function createSessionFactSourceError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

export function resolveSitePullSessionFacts(facts = {}, {
  errorCode = 'SITE_PULL_SESSION_FACTS_INVALID',
} = {}) {
  if (!hasOwn(facts, 'session')) return {};
  if (isObjectRecord(facts.session)) return facts.session;
  throw createSessionFactSourceError(errorCode, {
    factKey: 'session',
  });
}

// One current-session projection for every evidence consumer. A measured zero
// never borrows an estimate, and an hourly sum is never a strict session maximum.
export function resolveSitePullSessionShape(facts = {}, options = {}) {
  const source = resolveSitePullSessionFacts(facts, options);
  const number = (key) => {
    if (!Object.hasOwn(source, key)) return 0;
    const value = source[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw createSessionFactSourceError(options.errorCode || 'SITE_PULL_SESSION_FACTS_INVALID', { field: key });
    }
    return value;
  };
  const measuredMode = source.hasMeasuredSessionFacts === true;
  const estimatedMode = !measuredMode && source.hasEstimatedSessionFacts === true;
  const sessionCount = measuredMode ? number('measuredSessionCount') : estimatedMode ? number('estimatedSessionCount') : 0;
  const shortSessionCount = measuredMode ? number('shortSessionCount') : estimatedMode ? number('estimatedShortSessionCount') : 0;
  const longSessionCount = measuredMode ? number('longSessionCount') : 0;
  return {
    sessionCount, shortSessionCount, longSessionCount,
    shortSessionRate: sessionCount > 0 ? shortSessionCount / sessionCount : 0,
    averageSessionMs: sessionCount > 0 ? number(measuredMode ? 'measuredAverageSessionMs' : 'estimatedAverageSessionMs') : 0,
    maxSessionMs: measuredMode && sessionCount > 0 ? number('maxSessionMs') : 0,
    hasMeasuredSessionFacts: measuredMode && sessionCount > 0,
    hasEstimatedSessionFacts: estimatedMode && sessionCount > 0,
    hasSessionFacts: sessionCount > 0,
    sessionBasis: measuredMode && sessionCount > 0 ? 'measured_session' : estimatedMode && sessionCount > 0 ? 'hourly_proxy' : 'unavailable',
  };
}
