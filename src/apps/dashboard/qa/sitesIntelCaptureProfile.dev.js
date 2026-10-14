import { useMemo, useSyncExternalStore } from 'react';
import { buildSiteIntelCaptureFixture } from './siteIntelCaptureFixtures.dev.js';

const PARAM = 'entropy-qa-sites-intel';
const snapshot = () => new URLSearchParams(globalThis.location.search).get(PARAM);
const subscribe = (notify) => {
  globalThis.addEventListener('popstate', notify);
  return () => globalThis.removeEventListener('popstate', notify);
};
export function useSitesIntelCaptureProfile(intel) {
  const id = useSyncExternalStore(subscribe, snapshot, () => null);
  const fixture = useMemo(() => id && intel?.domain ? buildSiteIntelCaptureFixture(id, intel.domain) : null, [id, intel?.domain]);
  return useMemo(() => fixture ? { ...fixture, type: intel.type, registryEntry: intel.registryEntry } : intel, [fixture, intel]);
}
