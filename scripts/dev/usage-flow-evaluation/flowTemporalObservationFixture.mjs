import { FeedItemObservationWindow } from '../../../src/domains/nudge/feed-flow/observation/FeedItemObservationWindow.js';
import { FeedObservationJournal, FEED_OBSERVATION_JOURNAL_MAX_CAPACITY } from '../../../src/domains/nudge/feed-flow/observation/FeedObservationJournal.js';
import { FEED_OBSERVATION_MAX_SAMPLE_GAP_MS } from '../../../src/domains/nudge/feed-flow/observation/FeedLiveObservation.js';

// The fixture authors geometry, then uses the actual item/identity and journal
// owners. It is not a claim that live DOM acquisition or input persistence works.
export function createTemporalObservationFixture(recipe, { capacity = FEED_OBSERVATION_JOURNAL_MAX_CAPACITY, scrollParts = 1 } = {}) {
  if (!recipe || !Number.isSafeInteger(recipe.endMs) || recipe.endMs <= 0 || recipe.endMs > 3600000
    || !Number.isSafeInteger(recipe.sampleEveryMs) || recipe.sampleEveryMs <= 0
    || recipe.endMs % recipe.sampleEveryMs !== 0 || !Number.isSafeInteger(recipe.captureEveryMs)
    || recipe.captureEveryMs <= 0 || recipe.captureEveryMs % recipe.sampleEveryMs !== 0
    || !Number.isSafeInteger(recipe.columns) || recipe.columns < 1 || recipe.columns > 20
    || !Array.isArray(recipe.phases) || !recipe.phases.length
    || recipe.phases.at(-1).untilMs !== recipe.endMs
    || !Number.isSafeInteger(scrollParts) || scrollParts < 1 || scrollParts > 20) throw new Error('TEMPORAL_FIXTURE_INVALID');
  for (const [index, phase] of recipe.phases.entries()) {
    if (!Number.isSafeInteger(phase.untilMs) || phase.untilMs <= (index ? recipe.phases[index - 1].untilMs : 0)
      || !Number.isFinite(phase.velocity) || Math.abs(phase.velocity) > 10
      || ['available', 'editorAvailable', 'focused'].some((key) => typeof phase[key] !== 'boolean')
      || ['inputEveryMs', 'reverseEveryMs', 'identityEveryMs'].some((key) => !Number.isSafeInteger(phase[key]) || phase[key] < 0)
      || !Number.isSafeInteger(phase.inputBatch) || phase.inputBatch < 1 || phase.inputBatch > 100) throw new Error('TEMPORAL_PHASE_INVALID');
  }
  const ledger = new FeedItemObservationWindow();
  const journal = new FeedObservationJournal({ capacity });
  const hold = FEED_OBSERVATION_MAX_SAMPLE_GAP_MS;
  const nodes = new Map();
  const frames = [];
  const editorEvents = [];
  let position = 1000;
  let wasAvailable = false;
  let editorState = null;
  const frame = (at) => ({ ownerId: 'authored-document', at, observation: { version: 1, active: true,
    epoch: 1, at, maxSampleHoldMs: hold, eventJournal: journal.getSnapshot() } });
  frames.push(frame(0));
  for (let at = 0; at <= recipe.endMs; at += recipe.sampleEveryMs) {
    const phase = at === recipe.endMs ? recipe.phases.at(-1) : recipe.phases.find((value) => at < value.untilMs);
    const displacement = at === 0 ? 0 : phase.velocity * recipe.sampleEveryMs / 1000
      * (phase.reverseEveryMs && Math.floor(at / phase.reverseEveryMs) % 2 ? -1 : 1);
    position += displacement;
    const nextState = { kind: 'editor_state', at, available: phase.editorAvailable,
      focused: phase.editorAvailable ? phase.focused : null };
    if (!editorState || nextState.available !== editorState.available || nextState.focused !== editorState.focused) {
      editorEvents.push(nextState); editorState = nextState;
    }
    if (phase.editorAvailable && phase.inputEveryMs && at % phase.inputEveryMs === 0) {
      for (let i = 0; i < phase.inputBatch; i += 1) editorEvents.push({ kind: 'input_activity', at });
    }
    if (!phase.available && wasAvailable) {
      ledger.invalidate(at); journal.append({ kind: 'observation_gap', at, epoch: 1 });
    }
    if (phase.available) {
      if (wasAvailable && displacement) {
        ledger.endHold(at);
        for (let part = 0; part < scrollParts; part += 1) journal.append({ kind: 'scroll_displacement', at, epoch: 1, source: 'unknown',
          direction: displacement > 0 ? 'forward' : 'backward', screenfuls: Math.abs(displacement) / scrollParts });
      }
      const items = [];
      const revision = phase.identityEveryMs ? Math.floor(at / phase.identityEveryMs) : 0;
      for (let row = Math.floor(position); row < Math.ceil(position + 1); row += 1) {
        const fraction = Math.min(row + 1, position + 1) - Math.max(row, position);
        for (let column = 0; column < recipe.columns; column += 1) {
          const key = `${row}:${column}:${revision}`;
          if (!nodes.has(key)) nodes.set(key, {});
          items.push({ element: nodes.get(key), contentKey: key, geometryStatus: 'measured',
            itemFraction: fraction, regionFraction: fraction / recipe.columns });
        }
      }
      journal.append(ledger.sample({ at, epoch: 1, layout: recipe.columns === 1 ? 'vertical_list' : 'grid', items },
        { validUntil: at + hold }));
    }
    wasAvailable = phase.available;
    if (at % recipe.captureEveryMs === 0 || at === recipe.endMs) frames.push(frame(at));
  }
  return { feedTrace: { version: 1, clockBasis: 'shared_monotonic_milliseconds', startMs: 0,
    endMs: recipe.endMs, frames }, editorEvents: editorEvents.map((event) => ({ ...event, availableAt: event.at })) };
}
