import { useEffect, useMemo, useState } from 'react';
import { buildProtectedSiteKoiCandidatePool } from './zenProtectedSiteKoiCandidates.js';
import { advanceZenKoiSelection, createZenKoiSelectionState } from './zenProtectedSiteKoiSelection.js';

export function useZenProtectedSiteKoiCandidates({ registeredSiteDomains, domainCandidates, blockedDomains,
  focusedDomain, enabled }) {
  const pool = useMemo(() => buildProtectedSiteKoiCandidatePool({ registeredSiteDomains, domainCandidates, blockedDomains }),
    [registeredSiteDomains, domainCandidates, blockedDomains]);
  const [selection, setSelection] = useState(() => advanceZenKoiSelection(createZenKoiSelectionState(), pool, Date.now(), focusedDomain));
  useEffect(() => {
    if (!enabled) return undefined;
    const update = () => setSelection(previous => advanceZenKoiSelection(previous, pool, Date.now(), focusedDomain));
    update();
    if (selection.nextReviewAt === null) return undefined;
    const timer = setTimeout(update, Math.max(1, selection.nextReviewAt - Date.now()));
    return () => clearTimeout(timer);
  }, [pool, focusedDomain, enabled, selection.nextReviewAt]);
  return useMemo(() => {
    const byDomain = new Map(pool.map(candidate => [candidate.domain, candidate]));
    return selection.members.map(member => byDomain.get(member.domain)).filter(Boolean)
      .map((candidate, index) => ({ ...candidate, visibleRank: index + 1 }));
  }, [pool, selection.members]);
}
