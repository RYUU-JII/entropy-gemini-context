// Detached experiment: reserve a viable successor before an upper framework
// spends its fork opportunity on another longitudinal flush. No new grant,
// geometry repair, crown target, or permission to bypass an occupied junction.
import {zenG15HorizonMaturity} from './ZenBonsaiG15AxisHorizon.js';
export function resolveZenG15ApicalPlanning(value = 'baseline') {
    if (!['baseline', 'candidate'].includes(value)) throw new Error('ZEN_G15_APICAL_PLANNING_TREATMENT_INVALID');
    return value === 'candidate';
}

export function planZenG15ApicalSuccession(context, spec, count, lateralFraction) {
    if (!resolveZenG15ApicalPlanning(context.apicalPlanningTreatment) || spec.root || spec.tier !== 0) return null;
    const radius = spec.apicalPlanningRadius ?? spec.radius;
    if (!Number.isFinite(radius) || radius <= 0) throw new Error('ZEN_G15_APICAL_PLANNING_RADIUS_REQUIRED');
    const horizon=context.consolidation?.horizon;
    const maturity = horizon ? zenG15HorizonMaturity(radius,context.vigor) : Math.max(0, Math.min(1, (10 - radius) / 5));
    if (maturity === 0) return null;
    // The existing fork gate requires at most .18. Keep its full cost in the
    // same family account; a poor family cannot promise unsupported children.
    const construction = .181;
    const maximumFraction = Math.min(.42, .68 - lateralFraction);
    if (spec.familyConstructionGrant * maximumFraction < construction) return null;
    return Object.freeze({
        semantics: 'funded_apical_succession_v1',
        reservedConstruction: construction,
        windowStart: horizon ? Math.max(3,Math.min(count,Math.round(count*(.9-.1*maturity))))
            : Math.max(2, Math.min(count, Math.round(count * (.85 - .2 * maturity)))),
        authority: 'fork_opportunity_only',
    });
}

export function zenG15ApicalWindowDue(frontier, differentiation) {
    const portfolio = frontier.constructionPortfolio, plan = portfolio?.apicalSuccessionPlan;
    return Boolean(plan && differentiation.ready && portfolio.cursor >= plan.windowStart
        && portfolio.descendantConstructionBudget >= plan.reservedConstruction - 1e-7);
}
