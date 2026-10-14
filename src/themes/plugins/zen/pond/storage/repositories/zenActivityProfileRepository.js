import {
    clearZenKoiActivityProfileMap,
    ensureZenKoiActivityProfile,
    hydrateZenKoiActivityProfileMap,
    maybeRebindZenKoiActivityProfile,
    readZenKoiActivityProfileMap,
    getZenKoiActivityProfileStorageError,
    subscribeZenKoiActivityProfileStorageErrors,
    writeZenKoiActivityProfileMap,
} from '../zenPondStorage.js';

const readActivityProfileMap = () => readZenKoiActivityProfileMap();
const hydrateActivityProfileMap = () => hydrateZenKoiActivityProfileMap();
const writeActivityProfileMap = (candidate) => writeZenKoiActivityProfileMap(candidate);
const clearActivityProfileMap = () => clearZenKoiActivityProfileMap();
const ensureActivityProfile = (domain, options = {}) => ensureZenKoiActivityProfile(domain, options);
const maybeRebindActivityProfile = (domain, options = {}) => maybeRebindZenKoiActivityProfile(domain, options);
const getActivityProfileStorageError = () => getZenKoiActivityProfileStorageError();
const subscribeActivityProfileStorageErrors = (listener) => (
    subscribeZenKoiActivityProfileStorageErrors(listener)
);

export {
    readActivityProfileMap,
    hydrateActivityProfileMap,
    writeActivityProfileMap,
    clearActivityProfileMap,
    ensureActivityProfile,
    maybeRebindActivityProfile,
    getActivityProfileStorageError,
    subscribeActivityProfileStorageErrors,
};
