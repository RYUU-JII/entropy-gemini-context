// Private to the direct Worker-owned F4 -> Rhythm producer. Its observations
// contain ordinary enumerable data objects/arrays and scalar values, with no
// accessors, Proxy, external metadata or injected diagnostics result. Producer
// shape changes must update this owner and its domain contract together.
export function copyZenGeneratedRhythmObservation(source) {
  const seen = new Map();
  function copy(value) {
    if (value === null || typeof value !== 'object') {
      if (typeof value === 'function' || typeof value === 'symbol') {
        throw Error('ZEN_CHERRY_CLOUD_GENERATED_OBSERVATION_NON_DATA');
      }
      return value;
    }
    if (seen.has(value)) return seen.get(value);
    const array = Array.isArray(value);
    if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)
        || Object.getOwnPropertySymbols(value).length) {
      throw Error('ZEN_CHERRY_CLOUD_GENERATED_OBSERVATION_SHAPE');
    }
    const result = array ? new Array(value.length) : {};
    seen.set(value, result);
    for (const key of Object.keys(value)) {
      if (key === '__proto__') throw Error('ZEN_CHERRY_CLOUD_GENERATED_OBSERVATION_KEY');
      result[key] = copy(value[key]);
    }
    return result;
  }
  return copy(source);
}
