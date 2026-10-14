export function resolvePageLocalStorageRef() {
  if (typeof globalThis === 'undefined') {
    return null;
  }

  const storage = globalThis.localStorage
    || globalThis.window?.localStorage
    || null;
  if (
    !storage
    || typeof storage.getItem !== 'function'
    || typeof storage.setItem !== 'function'
    || typeof storage.removeItem !== 'function'
  ) {
    return null;
  }

  return storage;
}

export function readPageLocalStorageItem(key, fallback = null) {
  if (typeof key !== 'string' || !key.trim()) {
    return fallback;
  }

  const storage = resolvePageLocalStorageRef();
  if (!storage) {
    return fallback;
  }

  try {
    const value = storage.getItem(key.trim());
    return value === null ? fallback : value;
  } catch (_error) {
    return fallback;
  }
}

export function writePageLocalStorageItem(key, value) {
  if (typeof key !== 'string' || !key.trim()) {
    return false;
  }

  const storage = resolvePageLocalStorageRef();
  if (!storage) {
    return false;
  }

  if (value === undefined || value === null) {
    return removePageLocalStorageItem(key);
  }

  try {
    storage.setItem(key.trim(), String(value));
    return true;
  } catch (_error) {
    return false;
  }
}

export function removePageLocalStorageItem(key) {
  if (typeof key !== 'string' || !key.trim()) {
    return false;
  }

  const storage = resolvePageLocalStorageRef();
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key.trim());
    return true;
  } catch (_error) {
    return false;
  }
}

export function readPageLocalJsonItem(key, fallback = null) {
  const raw = readPageLocalStorageItem(key, null);
  if (typeof raw !== 'string' || !raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return fallback;
  }
}

export function writePageLocalJsonItem(key, value) {
  if (value === undefined) {
    return removePageLocalStorageItem(key);
  }

  try {
    return writePageLocalStorageItem(key, JSON.stringify(value));
  } catch (_error) {
    return false;
  }
}

export function readPageLocalBooleanFlag(
  key,
  {
    fallback = false,
    truthyValues = ['1', 'true'],
    falsyValues = ['0', 'false'],
  } = {},
) {
  const raw = readPageLocalStorageItem(key, null);
  if (raw === null || raw === undefined) {
    return Boolean(fallback);
  }

  const normalized = String(raw).trim().toLowerCase();
  if (truthyValues.includes(normalized)) {
    return true;
  }
  if (falsyValues.includes(normalized)) {
    return false;
  }
  return Boolean(fallback);
}
