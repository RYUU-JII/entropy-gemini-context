import { CHERRY_ANNUAL_MODEL_ID, CHERRY_ANNUAL_PROFILE } from '../annual/profile.js';
import { copyZenCherryAnnualObservation } from '../annual/zenAnnualObservationCopy.js';
import { simulateZenCherry, inspectZenCherry } from '../annual/model.js';
import { CHERRY_RHYTHM_ANNUAL_MODEL_ID, CHERRY_RHYTHM_VARIANTS, CHERRY_RHYTHM_PROFILE } from './profile.js';

const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, s) => a.map((v) => v * s);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rounded = (n) => Math.round(n * 1e8) / 1e8;
const unit = (a) => {
  const length = Math.hypot(...a);
  if (!Number.isFinite(length) || length < 1e-9) throw new Error('Cherry annual: invalid direction.');
  return scale(a, 1 / length);
};

// Keyed draws preserve the identities of unaffected organs across treatments.
function draw(seed, key) {
  let h = (seed ^ 2166136261) >>> 0;
  for (let i = 0; i < key.length; i += 1) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const requireEntry = (map, id, name) => {
  if (!map.has(id)) throw new Error(`Cherry annual: missing ${name} ${id}.`);
  return map.get(id);
};

/**
 * Discrete annual organ model, deliberately detached from the product and F4.
 * Spring commits complete shoots and opens overwintered flower buds; summer
 * differentiates new lateral buds; winter releases the next eligible cohort.
 */
export function simulateZenCherryRhythm({ seed, years = 3, treatment = 'natural', variant = 'baseline' }) {
  if (!CHERRY_RHYTHM_VARIANTS.includes(variant)) throw new Error(`Cherry rhythm: unknown variant ${variant}.`);
  // An explicitly selected, admitted control arm, never a failure fallback.
  if (variant === 'baseline') return simulateZenCherry({ seed, years, treatment });
  const profile = CHERRY_ANNUAL_PROFILE;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Cherry annual: seed must be a uint32 integer.');
  if (!Number.isInteger(years) || years < 1 || years > profile.maxYears) throw new Error(`Cherry annual: years must be 1..${profile.maxYears}.`);
  if (!['natural', 'tip-pruned'].includes(treatment)) throw new Error(`Cherry annual: unknown treatment ${treatment}.`);

  const nodes = new Map();
  const axes = new Map();
  const buds = new Map();
  const annualUnits = new Map();
  const segments = [];
  const events = [];
  const snapshots = [];
  const history = [];
  let flowers = [];
  let cycle = 0;
  let phase = 'foundation';
  let leaderAxisId = 'a0';
  let pinchedAxisId = null;
  let ledger;

  const event = (type, subjectId, data = {}) => {
    const item = { id: `${cycle}:${phase}:${type}:${subjectId}`, type, cycle, phase, ...data };
    events.push(item);
    return item;
  };

  function checkBounds() {
    if (nodes.size > profile.maxNodes || axes.size > profile.maxAxes || buds.size > profile.maxBuds) {
      throw new Error(`Cherry annual: research size limit exceeded at cycle ${cycle}; no truncated tree was returned.`);
    }
  }

  function makeBud(annualUnit, nodeId, nodeIndex, placement, tangent) {
    const id = `${annualUnit.id}/b${nodeIndex}${placement === 'terminal' ? 't' : 'l'}`;
    const bud = {
      id, nodeId, axisId: annualUnit.axisId, unitId: annualUnit.id,
      nodeIndex, annualPosition: nodeIndex / annualUnit.nodeCount, placement, tangent: [...tangent],
      identity: 'vegetative', dormancy: cycle === 0 ? 'released' : 'resting',
      viability: 'alive', development: 'uncommitted', bornCycle: cycle,
      winterReleaseCycle: cycle === 0 ? 0 : null,
      inductionCycle: null, bloomCycle: null, activatedCycle: null,
      decisionCycles: [], lastDecisionCycle: null,
    };
    if (buds.has(id)) throw new Error(`Cherry annual: duplicate bud ${id}.`);
    buds.set(id, bud);
    return bud;
  }

  function lateralDirection(sourceBud, sourceAxis) {
    // A dormant bud retains its own attachment frame even when the distant
    // axis tip has extended or been pinched in later years.
    const tangent = sourceBud.tangent;
    const reference = Math.abs(tangent[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = unit(cross(tangent, reference));
    const v = unit(cross(u, tangent));
    const angle = sourceBud.nodeIndex * 2.399963 + draw(seed, `${sourceAxis.id}:azimuth`) * Math.PI * 2;
    const radial = add(scale(u, Math.cos(angle)), scale(v, Math.sin(angle)));
    return unit(add(add(scale(tangent, 0.67), scale(radial, 0.72)), [0, 0.1, 0]));
  }

  function shootPlan(sourceBud, kind, successor) {
    const parentAxis = requireEntry(axes, sourceBud.axisId, 'axis');
    const continuation = sourceBud.placement === 'terminal';
    const axisId = continuation ? parentAxis.id : `${sourceBud.id}/a`;
    const id = `${axisId}/y${cycle}`;
    const maturity = Math.max(0.66, 1 - parentAxis.branchOrder * 0.09);
    const terminalVigor = continuation || successor ? 1 : 0.64 + sourceBud.annualPosition * 0.29;
    const length = rounded((kind === 'long' ? profile.longLength : profile.shortLength)
      * maturity * terminalVigor * (0.87 + draw(seed, `${id}:length`) * 0.26));
    const nodeCount = kind === 'long' ? profile.longNodes : profile.shortNodes;
    const cost = rounded(length * 0.16 + nodeCount * 0.72 + 2.2);
    return { id, axisId, sourceBudId: sourceBud.id, parentAxisId: parentAxis.id, continuation,
      successor, kind, length, nodeCount, cost,
      direction: continuation ? [...parentAxis.direction] : lateralDirection(sourceBud, parentAxis) };
  }

  function terminalPolicy(sourceBud, axis) {
    const lastUnit = requireEntry(annualUnits, axis.unitIds[axis.unitIds.length - 1], 'last annual unit');
    if (cycle < CHERRY_RHYTHM_PROFILE.startsCycle || axis.kind === 'short') return null;
    let consecutiveLongs = 0;
    for (let index = axis.unitIds.length - 1; index >= 0; index -= 1) {
      if (requireEntry(annualUnits, axis.unitIds[index], 'annual history').kind !== 'long') break;
      consecutiveLongs += 1;
    }
    const policy = { variant, previousKind: lastUnit.kind, consecutiveLongs,
      axisId: axis.id, budId: sourceBud.id, committed: false, committedUnitId: null, committedCost: 0 };
    if (variant === 'cadence') {
      policy.requestedKind = consecutiveLongs >= CHERRY_RHYTHM_PROFILE.maxLongRun ? 'short' : 'long';
      return policy;
    }
    if (axis.creditUpdatedCycle === cycle) throw new Error(`Cherry rhythm: duplicate annual credit ${axis.id}.`);
    const maturity = Math.max(0.66, 1 - axis.branchOrder * 0.09);
    const nominalLong = profile.longLength * maturity * 0.16 + profile.longNodes * 0.72 + 2.2;
    const nominalShort = profile.shortLength * maturity * 0.16 + profile.shortNodes * 0.72 + 2.2;
    const allowance = rounded((CHERRY_RHYTHM_PROFILE.maxLongRun * nominalLong + nominalShort) / (CHERRY_RHYTHM_PROFILE.maxLongRun + 1));
    const openingCredit = Object.hasOwn(axis, 'extensionCredit') ? axis.extensionCredit : 0;
    const availableCredit = rounded(openingCredit + allowance);
    const longPlan = shootPlan(sourceBud, 'long', false);
    const shortPlan = shootPlan(sourceBud, 'short', false);
    if (availableCredit < 0 || shortPlan.cost > availableCredit) throw new Error(`Cherry rhythm: invalid development credit ${axis.id}.`);
    axis.extensionCredit = availableCredit;
    axis.creditUpdatedCycle = cycle;
    Object.assign(policy, { openingCredit, allowance, availableCredit,
      longProposalCost: longPlan.cost, shortProposalCost: shortPlan.cost,
      requestedKind: longPlan.cost <= availableCredit ? 'long' : 'short' });
    return policy;
  }

  function commitShoot(plan, sourceBud) {
    let axis;
    if (plan.continuation) {
      axis = requireEntry(axes, plan.axisId, 'continuation axis');
    } else {
      const parentAxis = requireEntry(axes, plan.parentAxisId, 'parent axis');
      axis = {
        id: plan.axisId, parentBudId: sourceBud.id, parentAxisId: parentAxis.id,
        familyId: 'family-0', kind: plan.kind, role: plan.successor ? 'leader' : 'lateral',
        birthCycle: cycle, branchOrder: parentAxis.branchOrder + 1,
        direction: [...plan.direction], unitIds: [], terminalBudId: null,
        status: 'alive', curvature: (draw(seed, `${plan.axisId}:curvature`) - 0.5) * 0.11,
      };
      axes.set(axis.id, axis);
    }
    const annualUnit = {
      id: plan.id, axisId: axis.id, cycle, kind: plan.kind, sourceBudId: sourceBud.id,
      originNodeId: sourceBud.nodeId, nodeIds: [], nodeCount: plan.nodeCount,
      length: plan.length, preformedNodes: plan.nodeCount, neoformedNodes: 0,
      state: 'elongated', constructionCost: plan.cost,
    };
    let parentNode = requireEntry(nodes, sourceBud.nodeId, 'source node');
    let direction = [...plan.direction];
    for (let index = 1; index <= plan.nodeCount; index += 1) {
      // Correlated axis curvature, not independent per-render-sample noise.
      const bend = axis.curvature * (plan.kind === 'short' ? 0.35 : 1);
      direction = unit(add(direction, [-direction[1] * bend, direction[0] * bend + 0.009, bend * 0.26]));
      const node = {
        id: `${annualUnit.id}/n${index}`,
        p: add(parentNode.p, scale(direction, plan.length / plan.nodeCount)).map(rounded),
        birthCycle: cycle,
      };
      nodes.set(node.id, node);
      annualUnit.nodeIds.push(node.id);
      segments.push({ id: `${annualUnit.id}/s${index}`, parentNodeId: parentNode.id, childNodeId: node.id,
        axisId: axis.id, unitId: annualUnit.id, kind: plan.kind, radius: plan.kind === 'long' ? 0.65 : 0.32, birthCycle: cycle });
      makeBud(annualUnit, node.id, index, index === plan.nodeCount ? 'terminal' : 'lateral', direction);
      parentNode = node;
    }
    annualUnits.set(annualUnit.id, annualUnit);
    axis.unitIds.push(annualUnit.id);
    axis.direction = direction;
    axis.terminalBudId = `${annualUnit.id}/b${plan.nodeCount}t`;
    if (cycle >= CHERRY_RHYTHM_PROFILE.startsCycle) {
      axis.bornKind = axis.kind;
      axis.currentKind = annualUnit.kind;
    }
    sourceBud.viability = 'spent';
    sourceBud.dormancy = 'none';
    sourceBud.development = 'flushed';
    sourceBud.activatedCycle = cycle;
    sourceBud.spawnedUnitId = annualUnit.id;
    if (plan.successor) {
      const former = requireEntry(axes, pinchedAxisId, 'pinched axis');
      former.role = 'former-leader';
      leaderAxisId = axis.id;
      axis.succeededAxisId = former.id;
      event('leader-succession', axis.id, { axisId: axis.id, budId: sourceBud.id, formerAxisId: former.id });
      pinchedAxisId = null;
    }
    ledger.spent = rounded(ledger.spent + plan.cost);
    ledger.remaining = rounded(ledger.allocated - ledger.spent);
    ledger.transactions.push({ id: `construction:${annualUnit.id}`, unitId: annualUnit.id,
      sourceBudId: sourceBud.id, kind: plan.kind, cost: plan.cost });
    event('shoot-grown', annualUnit.id, { unitId: annualUnit.id, axisId: axis.id, budId: sourceBud.id,
      kind: plan.kind, length: plan.length, cost: plan.cost });
    checkBounds();
  }

  function foundation() {
    nodes.set('origin', { id: 'origin', p: [0, 0, 0], birthCycle: 0 });
    const axis = { id: 'a0', parentBudId: null, parentAxisId: null, familyId: 'family-0',
      kind: 'long', role: 'leader', birthCycle: 0, branchOrder: 0,
      direction: unit([0.88, 0.45, (draw(seed, 'foundation-depth') - 0.5) * 0.22]),
      curvature: (draw(seed, 'foundation-curvature') - 0.5) * 0.055,
      unitIds: ['a0/y0'], terminalBudId: 'a0/y0/b6t', status: 'alive' };
    axes.set(axis.id, axis);
    const annualUnit = { id: 'a0/y0', axisId: 'a0', cycle: 0, kind: 'long', sourceBudId: null,
      originNodeId: 'origin', nodeIds: [], nodeCount: profile.longNodes,
      length: profile.foundationLength, preformedNodes: profile.longNodes, neoformedNodes: 0,
      state: 'mature', constructionCost: null };
    let parent = requireEntry(nodes, 'origin', 'origin');
    for (let index = 1; index <= profile.longNodes; index += 1) {
      axis.direction = unit(add(axis.direction, [-axis.direction[1] * axis.curvature, axis.direction[0] * axis.curvature, 0]));
      const node = { id: `${annualUnit.id}/n${index}`,
        p: add(parent.p, scale(axis.direction, profile.foundationLength / profile.longNodes)).map(rounded), birthCycle: 0 };
      nodes.set(node.id, node);
      annualUnit.nodeIds.push(node.id);
      segments.push({ id: `${annualUnit.id}/s${index}`, parentNodeId: parent.id, childNodeId: node.id,
        axisId: 'a0', unitId: annualUnit.id, kind: 'long', radius: 1.45 - index * 0.075, birthCycle: 0 });
      makeBud(annualUnit, node.id, index, index === profile.longNodes ? 'terminal' : 'lateral', axis.direction);
      parent = node;
    }
    annualUnits.set(annualUnit.id, annualUnit);
    event('foundation-established', 'a0', { axisId: 'a0', unitId: annualUnit.id, ageCycles: 1 });
  }

  function openFlowers() {
    flowers = [];
    for (const bud of buds.values()) {
      if (bud.identity !== 'floral' || bud.viability !== 'alive') continue;
      if (bud.inductionCycle !== cycle - 1 || bud.winterReleaseCycle !== cycle - 1 || bud.dormancy !== 'released') {
        throw new Error(`Cherry annual: floral cohort missed its winter gate: ${bud.id}.`);
      }
      const origin = requireEntry(nodes, bud.nodeId, 'flower support').p;
      const count = 3 + Math.floor(draw(seed, `${bud.id}:flower-count`) * 3);
      const familyPhase = draw(seed, `${bud.axisId}:flower-phase`) * Math.PI * 2;
      for (let index = 0; index < count; index += 1) {
        const id = `${bud.id}/flower${index}`;
        const angle = familyPhase + index * 2.399963 + draw(seed, `${id}:angle`) * 0.5;
        const distance = 3.2 + draw(seed, `${id}:pedicel`) * 3.8;
        const direction = unit([Math.cos(angle) * 0.9, 0.38 + draw(seed, `${id}:up`) * 0.7, Math.sin(angle) * 0.78]);
        flowers.push({ id, budId: bud.id, nodeId: bud.nodeId, axisId: bud.axisId,
          inductionCycle: bud.inductionCycle, bloomCycle: cycle,
          position: add(origin, scale(direction, distance)).map(rounded),
          radius: rounded(2.6 + draw(seed, `${id}:size`) * 1.2), pedicelLength: distance });
      }
      bud.bloomCycle = cycle;
      bud.development = 'flowering';
      bud.dormancy = 'active';
      event('flowers-opened', bud.id, { budId: bud.id, axisId: bud.axisId, inductionCycle: bud.inductionCycle, count });
    }
  }

  function springGrowth() {
    const eligible = [...buds.values()].filter((bud) => bud.identity === 'vegetative'
      && bud.viability === 'alive' && bud.dormancy === 'released' && bud.bornCycle < cycle);
    let successorBudId = null;
    if (pinchedAxisId !== null) {
      const choices = eligible.filter((bud) => bud.axisId === pinchedAxisId && bud.placement === 'lateral')
        .sort((a, b) => b.bornCycle - a.bornCycle || b.annualPosition - a.annualPosition || a.id.localeCompare(b.id));
      if (choices.length === 0) throw new Error('Cherry annual: pinched leader has no living successor bud.');
      successorBudId = choices[0].id;
    }
    const candidates = eligible.map((bud) => {
      if (bud.lastDecisionCycle === cycle) throw new Error(`Cherry annual: duplicate seasonal draw ${bud.id}.`);
      bud.lastDecisionCycle = cycle;
      bud.decisionCycles.push(cycle);
      const axis = requireEntry(axes, bud.axisId, 'bud axis');
      const supportingUnit = requireEntry(annualUnits, bud.unitId, 'bud annual unit');
      const successor = bud.id === successorBudId;
      let kind = null;
      let priority = 6;
      let policy = null;
      if (successor) { kind = 'long'; priority = 0; }
      else if (bud.placement === 'terminal') {
        policy = terminalPolicy(bud, axis);
        kind = policy === null ? axis.kind : policy.requestedKind;
        priority = axis.role === 'leader' ? 0 : kind === 'short' ? 1 : 2;
      }
      else if (supportingUnit.kind === 'long') {
        // Position restarts for EACH annual unit; world height is not acrotony.
        const position = bud.annualPosition;
        const age = cycle - bud.bornCycle;
        const probability = position >= profile.distalStart ? 0.46 : position > profile.basalLimit ? 0.76 : 0.055;
        const release = Math.min(0.1, (age - 1) * 0.025);
        if (draw(seed, `${bud.id}:activation:${cycle}`) < probability + release) {
          kind = position >= profile.distalStart && axis.branchOrder < 2 ? 'long' : 'short';
          priority = kind === 'short' ? 3 : 4;
        }
      }
      return { bud, kind, successor, priority, policy };
    }).sort((a, b) => a.priority - b.priority || a.bud.id.localeCompare(b.bud.id));
    for (const candidate of candidates) {
      const { bud, kind, successor, policy } = candidate;
      let decision = 'dormant';
      if (kind !== null) {
        const plan = shootPlan(bud, kind, successor);
        if (plan.cost <= ledger.remaining) {
          commitShoot(plan, bud);
          decision = kind;
          if (policy !== null) {
            policy.committed = true;
            policy.committedUnitId = plan.id;
            policy.committedCost = plan.cost;
            if (variant === 'renewal') {
              const axis = requireEntry(axes, bud.axisId, 'credit axis');
              axis.extensionCredit = rounded(axis.extensionCredit - plan.cost);
              if (axis.extensionCredit < 0) throw new Error(`Cherry rhythm: negative committed credit ${axis.id}.`);
            }
          }
        } else {
          decision = 'budget-deferred';
          ledger.deferredBudIds.push(bud.id);
          if (successor) throw new Error('Cherry annual: reserved successor proposal is unaffordable.');
        }
      }
      if (bud.viability === 'alive') bud.dormancy = 'quiescent';
      event('bud-decision', bud.id, { budId: bud.id, axisId: bud.axisId, decision,
        annualPosition: bud.annualPosition, yearsWaiting: cycle - bud.bornCycle });
      if (policy !== null) {
        policy.decision = decision;
        if (variant === 'renewal') policy.closingCredit = requireEntry(axes, bud.axisId, 'credit axis').extensionCredit;
        const recorded = event('shoot-kind-decision', bud.id, policy);
        history.push(recorded);
      }
    }
  }

  function summerDevelopment() {
    for (const bud of buds.values()) {
      if (bud.development === 'flowering') {
        bud.development = 'spent';
        bud.viability = 'spent';
        bud.dormancy = 'none';
        event('flowers-shed', bud.id, { budId: bud.id, axisId: bud.axisId });
      }
      if (bud.bornCycle !== cycle || bud.placement !== 'lateral' || bud.viability !== 'alive') continue;
      const supportingUnit = requireEntry(annualUnits, bud.unitId, 'induction annual unit');
      const eligible = supportingUnit.kind === 'short' || bud.annualPosition <= profile.basalLimit;
      if (eligible && draw(seed, `${bud.id}:induction`) < profile.floralInductionProbability) {
        bud.identity = 'floral';
        bud.inductionCycle = cycle;
        bud.development = 'differentiated';
        event('floral-induced', bud.id, { budId: bud.id, axisId: bud.axisId, unitId: bud.unitId, inductionCycle: cycle });
      }
    }
    flowers = [];
    if (cycle === 1 && treatment === 'tip-pruned') {
      const leader = requireEntry(axes, leaderAxisId, 'leader');
      const terminal = requireEntry(buds, leader.terminalBudId, 'leader terminal');
      terminal.viability = 'removed';
      terminal.development = 'pinched';
      terminal.dormancy = 'none';
      leader.status = 'tip-pinched';
      pinchedAxisId = leader.id;
      event('terminal-pinched', terminal.id, { budId: terminal.id, axisId: leader.id, nodeId: terminal.nodeId,
        treatment: 'tip-pruned', intervention: 'First-year terminal bud pinching; existing wood is retained.' });
    }
    for (const annualUnit of annualUnits.values()) if (annualUnit.cycle === cycle) annualUnit.state = 'mature';
    // Allometric visual thickening, kept separate from the shoot-construction
    // ledger. Already deposited radius never shrinks after terminal pinching.
    const support = new Map([...nodes.keys()].map((id) => [id, 0]));
    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const segment = segments[index];
      const supported = requireEntry(support, segment.childNodeId, 'support') + 1;
      support.set(segment.parentNodeId, support.get(segment.parentNodeId) + supported);
      const prior = segment.kind === 'long' ? 0.5 : 0.22;
      segment.radius = rounded(Math.max(segment.radius, prior + 0.24 * Math.pow(supported, 0.52) + (cycle - segment.birthCycle) * 0.035));
    }
  }

  function winterRelease() {
    for (const bud of buds.values()) {
      if (bud.viability !== 'alive') continue;
      bud.dormancy = 'released';
      bud.winterReleaseCycle = cycle;
      event('winter-released', bud.id, { budId: bud.id, axisId: bud.axisId, identity: bud.identity });
    }
  }

  function snapshot() {
    const allBuds = [...buds.values()];
    const allUnits = [...annualUnits.values()];
    snapshots.push(copyZenCherryAnnualObservation({ id: `year-${cycle}-${phase}`, cycle, phase,
      nodes: [...nodes.values()], segments, axes: [...axes.values()], annualUnits: allUnits,
      buds: allBuds, flowers, events: events.filter((item) => item.cycle === cycle && item.phase === phase), ledger,
      metrics: {
        longUnits: allUnits.filter((item) => item.kind === 'long').length,
        shortUnits: allUnits.filter((item) => item.kind === 'short').length,
        dormantBuds: allBuds.filter((item) => item.identity === 'vegetative' && item.viability === 'alive').length,
        floralBuds: allBuds.filter((item) => item.identity === 'floral' && item.viability === 'alive').length,
        flowers: flowers.length,
        persistentShortAxes: [...axes.values()].filter((item) => item.kind === 'short' && item.unitIds.length > 1).length,
        successors: events.filter((item) => item.type === 'leader-succession').length,
        dormantRevisits: allBuds.filter((item) => item.decisionCycles.length > 1).length,
        budgetRemaining: ledger.remaining,
      },
    }));
  }

  foundation();
  for (cycle = 1; cycle <= years; cycle += 1) {
    const allocated = profile.initialAnnualBudget + (cycle - 1) * profile.additionalAnnualBudget;
    ledger = { cycle, unit: profile.budgetUnit, scope: profile.budgetScope,
      allocated, spent: 0, remaining: allocated, transactions: [], deferredBudIds: [] };
    phase = 'spring';
    if (cycle >= CHERRY_RHYTHM_PROFILE.startsCycle) for (const axis of axes.values()) {
      axis.bornKind = axis.kind;
      axis.currentKind = requireEntry(annualUnits, axis.unitIds[axis.unitIds.length - 1], 'current annual unit').kind;
    }
    openFlowers();
    springGrowth();
    snapshot();
    phase = 'summer';
    summerDevelopment();
    snapshot();
    phase = 'winter';
    winterRelease();
    snapshot();
  }
  return { schema: CHERRY_RHYTHM_ANNUAL_MODEL_ID, seed, years, treatment, variant,
    profile: structuredClone(profile), policy: structuredClone(CHERRY_RHYTHM_PROFILE), snapshots, events, history };
}

/** The preserved annual graph contract plus this experiment's fate/credit rules. */
export function inspectZenCherryRhythmAnnual(result) {
  if (result && result.schema === CHERRY_ANNUAL_MODEL_ID) return inspectZenCherry(result);
  if (!result || result.schema !== CHERRY_RHYTHM_ANNUAL_MODEL_ID || !['cadence', 'renewal'].includes(result.variant)) return ['Invalid cherry rhythm annual schema.'];
  // Explicit compatibility bridge: the candidate intentionally retains the
  // original organ graph shape, while its model identity remains distinct.
  const errors = inspectZenCherry({ ...result, schema: CHERRY_ANNUAL_MODEL_ID });
  const birthKinds = new Map();
  for (const snapshot of result.snapshots) {
    const fail = (message) => errors.push(`${snapshot.id}: ${message}`);
    const axes = new Map(snapshot.axes.map((axis) => [axis.id, axis]));
    const units = new Map(snapshot.annualUnits.map((annualUnit) => [annualUnit.id, annualUnit]));
    for (const axis of snapshot.axes) {
      if (birthKinds.has(axis.id) && birthKinds.get(axis.id) !== axis.kind) fail(`Historical axis birth kind changed ${axis.id}.`);
      birthKinds.set(axis.id, axis.kind);
      const lastUnit = units.get(axis.unitIds[axis.unitIds.length - 1]);
      if (snapshot.cycle >= CHERRY_RHYTHM_PROFILE.startsCycle && (axis.bornKind !== axis.kind || axis.currentKind !== lastUnit.kind)) fail(`Current unit kind disagrees with realized growth ${axis.id}.`);
      if (Object.hasOwn(axis, 'extensionCredit') && (!Number.isFinite(axis.extensionCredit) || axis.extensionCredit < 0)) fail(`Negative/invalid development credit ${axis.id}.`);
    }
    for (const annualUnit of snapshot.annualUnits) {
      const axis = axes.get(annualUnit.axisId);
      if (axis.kind === 'short' && annualUnit.kind !== 'short') fail(`Born-short axis left the declared scope ${axis.id}.`);
    }
    for (const bud of snapshot.buds) {
      if (bud.identity !== 'floral') continue;
      const annualUnit = units.get(bud.unitId);
      if (annualUnit.kind !== 'short' && bud.annualPosition > CHERRY_ANNUAL_PROFILE.basalLimit) fail(`Floral eligibility ignored actual annual kind ${bud.id}.`);
    }
    for (const record of snapshot.events.filter((event) => event.type === 'shoot-kind-decision')) {
      if (record.cycle < CHERRY_RHYTHM_PROFILE.startsCycle || record.phase !== 'spring') fail(`Policy ran before its intervention ${record.id}.`);
      if (record.committed) {
        const annualUnit = units.get(record.committedUnitId);
        if (!annualUnit || annualUnit.kind !== record.requestedKind || annualUnit.constructionCost !== record.committedCost) fail(`Policy commit lacks its real shoot ${record.id}.`);
      } else if (record.committedCost !== 0 || record.committedUnitId !== null) fail(`Uncommitted proposal spent credit ${record.id}.`);
      if (result.variant === 'cadence') {
        const expected = record.consecutiveLongs >= CHERRY_RHYTHM_PROFILE.maxLongRun ? 'short' : 'long';
        if (record.requestedKind !== expected) fail(`Cadence did not follow realized annual history ${record.id}.`);
      } else {
        const axis = axes.get(record.axisId);
        if (Math.abs(record.openingCredit + record.allowance - record.availableCredit) > 1e-7
          || Math.abs(record.availableCredit - record.committedCost - record.closingCredit) > 1e-7
          || record.closingCredit < 0 || Math.abs(axis.extensionCredit - record.closingCredit) > 1e-7) fail(`Development credit does not balance ${record.id}.`);
        if (record.requestedKind !== (record.longProposalCost <= record.availableCredit ? 'long' : 'short')) fail(`Renewal decision ignored proposal affordability ${record.id}.`);
      }
    }
  }
  return errors;
}

