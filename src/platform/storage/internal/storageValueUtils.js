export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function areValuesEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!areValuesEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i += 1) {
      const key = aKeys[i];
      if (key !== bKeys[i]) return false;
      if (!areValuesEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

export function isEmptyPlainObject(value) {
  return isPlainObject(value) && Object.keys(value).length === 0;
}
