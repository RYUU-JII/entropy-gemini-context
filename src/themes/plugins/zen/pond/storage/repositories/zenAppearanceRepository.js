import {
    hydrateZenKoiDomainAppearanceMap,
    readZenKoiDomainAppearanceMap,
    writeZenKoiDomainAppearanceMap,
    ensureZenKoiAppearanceProfile,
    rerollZenKoiAppearanceWithinBreed,
    rerollZenKoiAppearanceBreed,
    rerollZenKoiAppearanceFull,
    subscribeZenKoiAppearanceChanges,
    getZenKoiAppearanceStorageError,
    subscribeZenKoiAppearanceStorageErrors,
} from '../zenPondStorage.js';

const readAppearanceMap = () => readZenKoiDomainAppearanceMap();
const hydrateAppearanceMap = () => hydrateZenKoiDomainAppearanceMap();
const writeAppearanceMap = (candidate) => writeZenKoiDomainAppearanceMap(candidate);
const ensureAppearanceProfile = (domain) => ensureZenKoiAppearanceProfile(domain);
const rerollAppearanceWithinBreed = (domain, options = {}) => rerollZenKoiAppearanceWithinBreed(domain, options);
const rerollAppearanceBreed = (domain, options = {}) => rerollZenKoiAppearanceBreed(domain, options);
const rerollAppearanceFull = (domain, options = {}) => rerollZenKoiAppearanceFull(domain, options);
const subscribeAppearanceChanges = (listener) => subscribeZenKoiAppearanceChanges(listener);
const getAppearanceStorageError = () => getZenKoiAppearanceStorageError();
const subscribeAppearanceStorageErrors = (listener) => (
    subscribeZenKoiAppearanceStorageErrors(listener)
);

export {
    readAppearanceMap,
    hydrateAppearanceMap,
    writeAppearanceMap,
    ensureAppearanceProfile,
    rerollAppearanceWithinBreed,
    rerollAppearanceBreed,
    rerollAppearanceFull,
    subscribeAppearanceChanges,
    getAppearanceStorageError,
    subscribeAppearanceStorageErrors,
};
