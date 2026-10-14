import {
  SITE_PULL_PATTERN_CATEGORIES,
  createSitePullPatternSignal,
} from '../sitePullPatternContracts.js';
import {
  clamp,
  toNumber,
} from '../patternUtils.js';
import { requireSitePullDetectorEvidenceProfile } from './detectorEvidenceProfiles.js';

function confidenceFromEvidenceStatus(status) {
  if (status === 'strong') return 0.84;
  if (status === 'candidate') return 0.62;
  if (status === 'weak') return 0.46;
  return 0.3;
}

export function detectNavigationAndFlowPatterns({
  checkingEvidenceProfile = null,
  backgroundResidencyEvidenceProfile = null,
  contentFlowEvidenceProfile = null,
  tabContextEvidenceProfile = null,
}) {
  const profile = requireSitePullDetectorEvidenceProfile(checkingEvidenceProfile, 'checking');
  const backgroundResidencyProfile = requireSitePullDetectorEvidenceProfile(
    backgroundResidencyEvidenceProfile,
    'background_residency',
  );
  const contentFlowProfile = requireSitePullDetectorEvidenceProfile(contentFlowEvidenceProfile, 'content_flow');
  const tabContextProfile = requireSitePullDetectorEvidenceProfile(tabContextEvidenceProfile, 'tab_context');
  const habitualEntry = profile.habitualEntry;
  const reloadChecking = profile.reloadChecking;
  const signals = [];

  if (tabContextProfile.canEmitNewTabSupport) {
    signals.push(createSitePullPatternSignal({
      id: 'new_tab_loop',
      category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
      severity: 'watch',
      tone: 'neutral',
      score: clamp(tabContextProfile.evidence.newTabScore * 100, 0, 100),
      confidence: tabContextProfile.confidence,
      evidence: {
        ...tabContextProfile.evidence,
        evidenceStatus: tabContextProfile.evidence.newTabEvidenceStatus,
      },
    }));
  }
  if (tabContextProfile.canEmitDuplicateTabSupport) {
    signals.push(createSitePullPatternSignal({
      id: 'duplicate_tab_entry',
      category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
      severity: 'watch',
      tone: 'neutral',
      score: clamp(tabContextProfile.evidence.duplicateTabScore * 100, 0, 100),
      confidence: tabContextProfile.confidence,
      evidence: {
        ...tabContextProfile.evidence,
        evidenceStatus: tabContextProfile.evidence.duplicateTabEvidenceStatus,
      },
    }));
  }
  if (tabContextProfile.canEmitTabHoardingSupport) {
    signals.push(createSitePullPatternSignal({
      id: 'tab_hoarding_context',
      category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
      severity: 'watch',
      tone: 'neutral',
      score: clamp(tabContextProfile.evidence.broadTabContextScore * 100, 0, 100),
      confidence: tabContextProfile.confidence,
      evidence: {
        ...tabContextProfile.evidence,
        evidenceStatus: tabContextProfile.evidence.tabHoardingEvidenceStatus,
      },
    }));
  }
  if (backgroundResidencyProfile.canEmitAtomic) {
    signals.push(createSitePullPatternSignal({
      id: 'background_residency',
      category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
      severity: 'watch',
      tone: 'neutral',
      score: clamp(backgroundResidencyProfile.score * 100, 0, 100),
      confidence: backgroundResidencyProfile.confidence,
      evidence: backgroundResidencyProfile.evidence,
    }));
  }
  if (contentFlowProfile.canEmitSkimSupport) {
    signals.push(createSitePullPatternSignal({
      id: 'feed_skimming',
      category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
      severity: 'watch',
      tone: 'neutral',
      score: clamp(contentFlowProfile.evidence.skimScore * 100, 0, 100),
      confidence: contentFlowProfile.confidence,
      evidence: contentFlowProfile.evidence,
    }));
  }
  if (contentFlowProfile.canEmitScrollSupport) {
    signals.push(createSitePullPatternSignal({
      id: 'fast_scroll_bursts',
      category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
      severity: 'watch',
      tone: 'neutral',
      score: clamp(contentFlowProfile.evidence.scrollVelocityScore * 100, 0, 100),
      confidence: contentFlowProfile.confidence,
      evidence: contentFlowProfile.evidence,
    }));
  }
  if (habitualEntry?.canEmitAtomic) {
    signals.push(createSitePullPatternSignal({
      id: 'habitual_entry',
      category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
      severity: 'watch',
      tone: 'neutral',
      score: clamp(toNumber(habitualEntry.evidence.directEntryShare) * 100, 0, 100),
      confidence: confidenceFromEvidenceStatus(habitualEntry.status),
      evidence: {
        typedEntrances: habitualEntry.evidence.typedEntrances,
        rawTypedEntrances: habitualEntry.evidence.rawTypedEntrances,
        addressBarEntrances: habitualEntry.evidence.addressBarEntrances,
        keywordEntrances: habitualEntry.evidence.keywordEntrances,
        rawTotalNavigations: habitualEntry.evidence.rawTotalNavigations,
        totalNavigations: habitualEntry.evidence.totalNavigations,
        navigationDenominator: habitualEntry.evidence.navigationDenominator,
        primaryNavigationCount: habitualEntry.evidence.primaryNavigationCount,
        directEntryShare: habitualEntry.evidence.directEntryShare,
        evidenceStatus: habitualEntry.status,
      },
    }));
  }
  if (reloadChecking?.canEmitAtomic) {
    signals.push(createSitePullPatternSignal({
      id: 'reload_checking',
      category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
      severity: 'watch',
      tone: 'warning',
      score: clamp(toNumber(reloadChecking.evidence.reloadShare) * 100, 0, 100),
      confidence: confidenceFromEvidenceStatus(reloadChecking.status),
      evidence: {
        reloads: reloadChecking.evidence.reloads,
        rawTotalNavigations: reloadChecking.evidence.rawTotalNavigations,
        totalNavigations: reloadChecking.evidence.totalNavigations,
        navigationDenominator: reloadChecking.evidence.navigationDenominator,
        primaryNavigationCount: reloadChecking.evidence.primaryNavigationCount,
        reloadShare: reloadChecking.evidence.reloadShare,
        evidenceStatus: reloadChecking.status,
      },
    }));
  }
  return signals;
}
