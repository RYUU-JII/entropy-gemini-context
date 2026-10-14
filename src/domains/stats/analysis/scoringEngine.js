import { formatTime } from '../../../lib/index.js';
import {
    buildScoreInsightCandidates,
    buildScoreLedger,
    SCORE_LEDGER_CATEGORY,
} from './scoreLedger.js';

export const DENSITY_BUFFER_MS = 60 * 60 * 1000;
export const SCORE_LOSS_CAPS = {
    compliance: 50,
    pattern: 0,
    shadow: 8,
};

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_SCORE_WINDOW_DAYS = 7;
export const TARGET_SESSION_MINUTES = 20;

export function calculateDigitalWellnessScore(window, goals = {}) {
    const totalActive = Math.max(0, Number(window.totalActive) || 0);
    const blockedActive = Math.max(0, Number(window.blockedActive) || 0);
    const unmanagedActive = Math.max(0, Number(window.unmanagedActive) || 0);
    const totalSwitches = window.totalSwitches || {};
    const switchCount = (
        (totalSwitches.toBlocked || 0)
        + (totalSwitches.toAllowed || 0)
        + (totalSwitches.toUnmanaged || 0)
        + (totalSwitches.internal || 0)
    );
    const goalMinutes = Math.max(0, Number(goals.globalGoal) || 0);
    const complianceMinutes = blockedActive / 60000;
    const ratio = totalActive > 0 ? blockedActive / totalActive : 0;
    const shadowRatio = totalActive > 0 ? unmanagedActive / totalActive : 0;
    const scoreLedger = buildScoreLedger({
        totalActiveMs: totalActive,
        protectedActiveMs: blockedActive,
        unmanagedActiveMs: unmanagedActive,
        criteriaCoveredActiveMs: window.criteriaCoveredActiveMs,
        globalGoalMinutes: goalMinutes,
        siteLimitsMinutes: goals.siteLimits,
        siteDetailsMs: window.siteDetails,
        switches: totalSwitches,
        switchCount,
        usageBaselines: goals.usageBaselines,
    });
    const userRuleLoss = scoreLedger.summary.categories[SCORE_LEDGER_CATEGORY.USER_RULE].deduction;
    const siteRuleLoss = scoreLedger.summary.categories[SCORE_LEDGER_CATEGORY.SITE_RULE].deduction;
    const shadowPenalty = scoreLedger.summary.categories[SCORE_LEDGER_CATEGORY.UNMANAGED_REVIEW].deduction;
    const lossCompliance = Math.min(50, userRuleLoss + siteRuleLoss);
    const score = scoreLedger.score;
    const displayScore = scoreLedger.displayScore;
    const scoringMode = scoreLedger.scoringMode;
    const criteriaCoverage = scoreLedger.criteriaCoverage;

    const breakdown = {
        compliance: lossCompliance,
        complianceRatio: userRuleLoss,
        complianceAbs: siteRuleLoss,
        pattern: 0,
        shadow: shadowPenalty,
    };

    const details = {
        complianceMinutes,
        goalMinutes,
        switches: switchCount,
        switchesPerHour: window.endIndex >= window.startIndex ? switchCount / (window.endIndex - window.startIndex + 1) : 0,
        ratios: {
            blocked: ratio,
            shadow: shadowRatio
        },
        scoreSummary: scoreLedger.summary,
        displayScore,
        scoringMode,
        criteriaCoverage,
    };

    return {
        score,
        displayScore,
        scoringMode,
        criteriaCoverage,
        breakdown,
        details,
        ledger: scoreLedger.entries,
        scoreSummary: scoreLedger.summary,
        scoreInsights: buildScoreInsightCandidates(scoreLedger),
    };
}

export const calculateDigitalWellnessBreakdown = calculateDigitalWellnessScore;

export function calculateFocusScoreFromTotals(totalActive, blockedActive) {
    const total = Math.max(0, Number(totalActive) || 0);
    const blocked = Math.max(0, Number(blockedActive) || 0);
    if (total <= 0) return 100;
    const ratio = blocked / total;
    const score = Math.max(0, Math.min(100, 100 - ratio * 100));
    return Math.round(score);
}

export function calculateFocusScore(dailyStats, blockedUrls) {
    if (!dailyStats || !dailyStats.domains) return 100;

    let totalActive = 0;
    let blockedActive = 0;

    Object.entries(dailyStats.domains).forEach(([domain, data]) => {
        const active = Number(data.active) || 0;
        totalActive += active;
        const isHostnameInList = (hostname, list) => {
            return list.some(pattern => {
                if (pattern.startsWith('*.')) {
                    const patternDomain = pattern.slice(2);
                    return hostname === patternDomain || hostname.endsWith(`.${patternDomain}`);
                }
                return hostname === pattern;
            });
        };
        if (isHostnameInList(domain, blockedUrls)) {
            blockedActive += active;
        }
    });

    return calculateFocusScoreFromTotals(totalActive, blockedActive);
}

export { formatTime };
