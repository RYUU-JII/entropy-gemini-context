import { clamp01, smooth01, toCount } from '../sitePullMath.js';

export const SITE_PULL_TAB_CONTEXT_EVIDENCE_PROFILE_VERSION = 'site-pull-tab-context-evidence-profile-v2';
export const SITE_PULL_TAB_CONTEXT_STATUSES = Object.freeze({
  INSUFFICIENT_TAB_CONTEXT_EVIDENCE: 'insufficient_tab_context_evidence',
  TAB_CONTEXT_OBSERVED: 'tab_context_observed',
  NEW_TAB_QUEUE: 'new_tab_queue',
  SAME_DOMAIN_TAB_QUEUE: 'same_domain_tab_queue',
  BROAD_TAB_QUEUE_CONTEXT: 'broad_tab_queue_context',
});

function primitive(id, count, candidate, strong, strength, evidence) {
  const status = strong ? 'strong' : candidate ? 'candidate' : count > 0 ? 'observed' : 'absent';
  const authorityKeys = [{ new_tab_loop: 'newTabEntrances', duplicate_tab_entry: 'duplicateTabEntrances',
    tab_hoarding_context: 'tabOpenContext' }[id]];
  return { id, status, strength, canEmitAtomic: candidate, canSupportComposite: candidate, evidence, authorityKeys };
}

// The recorder persists no total tab-context sample count. Visits/navigation
// are not denominators, and one event can increment all three counters.
export function buildSitePullTabContextEvidenceProfile({ facts = {} } = {}) {
  const behavior = facts.behavior || {};
  const hasBehaviorFacts = behavior.hasBehaviorFacts === true;
  const newTabEntrances = toCount(behavior.newTabEntrances);
  const duplicateTabEntrances = toCount(behavior.duplicateTabEntrances);
  const highOpenTabEntrances = toCount(behavior.highOpenTabEntrances);
  const maxSameDomainOpenTabs = toCount(behavior.maxSameDomainOpenTabs);
  const maxOpenTabs = toCount(behavior.maxOpenTabs);
  const newTabScore = smooth01(newTabEntrances, 1, 4);
  const duplicateTabScore = Math.max(smooth01(duplicateTabEntrances, 1, 4),
    smooth01(maxSameDomainOpenTabs, 2, 5) * 0.8);
  const broadTabContextScore = Math.max(smooth01(highOpenTabEntrances, 1, 4),
    smooth01(maxOpenTabs, 12, 30));
  const newTabChannel = hasBehaviorFacts && newTabEntrances >= 2;
  const duplicateTabChannel = hasBehaviorFacts && duplicateTabEntrances >= 2 && maxSameDomainOpenTabs >= 2;
  const sameDomainTabChannel = hasBehaviorFacts && maxSameDomainOpenTabs >= 2;
  const broadTabContextChannel = hasBehaviorFacts && (highOpenTabEntrances >= 2 || maxOpenTabs >= 20);
  const hasTabContextFacts = hasBehaviorFacts && [newTabEntrances, duplicateTabEntrances,
    highOpenTabEntrances, maxSameDomainOpenTabs, maxOpenTabs].some((count) => count > 0);
  const score = hasBehaviorFacts ? clamp01(Math.max(newTabScore, duplicateTabScore)) : 0;
  const canEmitTabQueueComposite = score >= 0.58 && sameDomainTabChannel
    && (newTabChannel || duplicateTabChannel);
  const status = canEmitTabQueueComposite
    ? (duplicateTabChannel ? SITE_PULL_TAB_CONTEXT_STATUSES.SAME_DOMAIN_TAB_QUEUE
      : SITE_PULL_TAB_CONTEXT_STATUSES.NEW_TAB_QUEUE)
    : hasTabContextFacts ? SITE_PULL_TAB_CONTEXT_STATUSES.TAB_CONTEXT_OBSERVED
      : SITE_PULL_TAB_CONTEXT_STATUSES.INSUFFICIENT_TAB_CONTEXT_EVIDENCE;
  const evidence = {
    tabContextStatus: status, tabQueueScore: score, newTabScore, duplicateTabScore, broadTabContextScore,
    newTabEntrances, duplicateTabEntrances, highOpenTabEntrances, maxSameDomainOpenTabs, maxOpenTabs,
    totalEntrances: null, newTabShare: null, duplicateShare: null,
    newTabChannel, duplicateTabChannel, sameDomainTabChannel, broadTabContextChannel,
    strongSameDomainQueue: duplicateTabEntrances >= 3 && maxSameDomainOpenTabs >= 3,
    tabQueueChannelCount: [newTabChannel, duplicateTabChannel, sameDomainTabChannel].filter(Boolean).length,
    hasBehaviorFacts, hasTabContextFacts, evidenceWindow: 'today',
    evidenceFamilyIds: ['tab_context_snapshot'], compositionBasis: 'single_family_intensity',
    temporalAssociation: 'day_cooccurrence', orderedSequenceObserved: false,
    caveats: ['tab_context_denominator_unavailable', 'overlapping_tab_event_projections',
      'browser_wide_context_not_site_specific', 'tab_presence_not_queue_intent'],
  };
  const newTabLoop = primitive('new_tab_loop', newTabEntrances, newTabChannel,
    newTabChannel && newTabEntrances >= 4, newTabScore, evidence);
  const duplicateTabEntry = primitive('duplicate_tab_entry', duplicateTabEntrances, duplicateTabChannel,
    duplicateTabChannel && duplicateTabEntrances >= 4, duplicateTabScore, evidence);
  const tabHoardingContext = primitive('tab_hoarding_context', Math.max(highOpenTabEntrances, maxOpenTabs),
    broadTabContextChannel, broadTabContextChannel && (highOpenTabEntrances >= 3 || maxOpenTabs >= 24),
    broadTabContextScore, evidence);
  Object.assign(evidence, {
    newTabEvidenceStatus: newTabLoop.status, duplicateTabEvidenceStatus: duplicateTabEntry.status,
    tabHoardingEvidenceStatus: tabHoardingContext.status,
  });
  return {
    version: SITE_PULL_TAB_CONTEXT_EVIDENCE_PROFILE_VERSION, status, score,
    confidence: hasTabContextFacts ? 0.76 : 0,
    canEmitTabQueueComposite, canEmitNewTabSupport: newTabChannel,
    canEmitDuplicateTabSupport: duplicateTabChannel, canEmitTabHoardingSupport: broadTabContextChannel,
    evidence, primitives: { newTabLoop, duplicateTabEntry, tabHoardingContext },
  };
}
