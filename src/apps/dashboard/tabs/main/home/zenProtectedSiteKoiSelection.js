export const ZEN_KOI_SELECTION_POLICY = Object.freeze({ capacity: 5, residenceMs: 60_000,
  challengeMs: 15_000, pressureRatio: 1.2, pressureGapMs: 60_000 });

export const createZenKoiSelectionState = () => ({ members: [], challenge: null, nextReviewAt: null });

// Presentation membership only. Current pressure and protection facts always
// come from the latest pool; this state cannot revive an unregistered site.
export function advanceZenKoiSelection(previous, pool, now, focusedDomain = null) {
  const policy = ZEN_KOI_SELECTION_POLICY;
  const byDomain = new Map(pool.map(candidate => [candidate.domain, candidate]));
  let members = previous.members.filter(member => byDomain.has(member.domain));
  const add = domain => { members = [...members, { domain, admittedAt: now }]; };
  const weakest = () => [...members].filter(member => member.domain !== focusedDomain)
    .sort((a, b) => byDomain.get(a.domain).weightedPressureMs - byDomain.get(b.domain).weightedPressureMs).at(0);
  if (byDomain.has(focusedDomain) && !members.some(member => member.domain === focusedDomain)) {
    if (members.length >= policy.capacity) {
      const victim = weakest();
      members = members.filter(member => member !== victim);
    }
    add(focusedDomain);
  }
  for (const candidate of pool) {
    if (members.length >= policy.capacity) break;
    if (!members.some(member => member.domain === candidate.domain)) add(candidate.domain);
  }
  const challenger = pool.find(candidate => !members.some(member => member.domain === candidate.domain));
  const incumbent = weakest();
  let challenge = null, nextReviewAt = null;
  if (challenger && incumbent) {
    const pressure = byDomain.get(incumbent.domain).weightedPressureMs;
    if (challenger.weightedPressureMs >= Math.max(pressure * policy.pressureRatio, pressure + policy.pressureGapMs)) {
      const same = previous.challenge?.incoming === challenger.domain && previous.challenge?.outgoing === incumbent.domain;
      challenge = same ? previous.challenge : { incoming: challenger.domain, outgoing: incumbent.domain, since: now };
      nextReviewAt = Math.max(challenge.since + policy.challengeMs, incumbent.admittedAt + policy.residenceMs);
      if (now >= nextReviewAt) {
        members = members.map(member => member === incumbent ? { domain: challenger.domain, admittedAt: now } : member);
        challenge = null;
        // Re-evaluate remaining challengers later, never replace the whole pond
        // in one pressure snapshot. The worker serializes physical crossings.
        nextReviewAt = now + policy.challengeMs;
      }
    }
  }
  const unchanged = members.length === previous.members.length
    && members.every((member, i) => member === previous.members[i])
    && challenge === previous.challenge && nextReviewAt === previous.nextReviewAt;
  return unchanged ? previous : { members, challenge, nextReviewAt };
}
