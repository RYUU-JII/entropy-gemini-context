export const FEED_ITEM_OBSERVATION_CAPACITY = 256;
const LAYOUTS = new Set(['vertical_list', 'paged_item', 'grid']);
const fail = (detail) => { throw new Error(`FEED_ITEM_OBSERVATION_INVALID:${detail}`); };
const fraction = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

// Local, bounded identity hypotheses and sampled geometry holds. The only input
// is the canonical geometry reader's facts. No content, URL or node is exported;
// sampled changes never assert navigation direction, attention or consumption.
export class FeedItemObservationWindow {
  constructor({ capacity = FEED_ITEM_OBSERVATION_CAPACITY } = {}) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > FEED_ITEM_OBSERVATION_CAPACITY) fail('capacity');
    this._capacity = capacity;
    this.reset();
  }

  reset({ epoch = null, at = null } = {}) {
    if ((epoch === null) !== (at === null) || (epoch !== null
      && (!Number.isSafeInteger(epoch) || epoch < 1 || !Number.isFinite(at) || at < 0))) fail('reset_epoch');
    this._at = at;
    this._epoch = epoch;
    this._nextId = 1;
    this._records = new Map();
    this._nodes = new Map();
    this._hints = new Map();
    this._hold = null;
    this._previous = null;
    this._lastSample = null;
    this._totals = { itemFractionMs: 0, regionFractionMs: 0, sampledHoldMs: 0,
      identityEvictions: 0, ambiguousHintSamples: 0, sampledSetChanges: 0,
      sampledSingleItemChanges: 0, reentryObservations: 0 };
  }

  advance(at) {
    if (!Number.isFinite(at) || at < 0 || (this._at !== null && at < this._at)) fail('clock');
    if (this._hold !== null) {
      const elapsed = Math.max(0, Math.min(at, this._hold.validUntil) - this._at);
      this._totals.sampledHoldMs += elapsed;
      for (const item of this._hold.items) {
        const record = this._records.get(item.itemId);
        if (!record) fail('held_identity_missing');
        const itemTime = elapsed * item.itemFraction;
        const regionTime = elapsed * item.regionFraction;
        record.itemFractionMs += itemTime;
        record.regionFractionMs += regionTime;
        this._totals.itemFractionMs += itemTime;
        this._totals.regionFractionMs += regionTime;
      }
      if (at >= this._hold.validUntil) this._hold = null;
    }
    if (this._previous !== null && at > this._previous.validUntil) this._previous = null;
    this._at = at;
  }

  endHold(at) {
    this.advance(at);
    this._hold = null;
  }

  invalidate(at) {
    this.endHold(at);
    this._previous = null;
  }

  release(at) {
    this.invalidate(at);
    this._nodes.clear();
    this._hints.clear();
    for (const record of this._records.values()) {
      record.element = null;
      record.key = '';
      record.lastKnownKey = '';
    }
  }

  _forget(record) {
    this._records.delete(record.itemId);
    if (this._nodes.get(record.element) === record.itemId) this._nodes.delete(record.element);
    if (record.key && this._hints.get(record.key) === record.itemId) this._hints.delete(record.key);
    this._totals.identityEvictions += 1;
  }

  _lookup(item, duplicateKeys) {
    const key = item.contentKey;
    const ambiguous = key !== '' && duplicateKeys.has(key);
    let record = this._records.get(this._nodes.get(item.element));
    // Hint enrichment or loss on the same observed node does not fabricate a
    // new item. A different nonempty hint is an observed node revision.
    if (record && record.lastKnownKey && key && record.lastKnownKey !== key) record = undefined;
    if (!record && key && !ambiguous) record = this._records.get(this._hints.get(key));
    return record;
  }

  _identify(item, duplicateKeys, protectedIds) {
    const key = item.contentKey;
    const ambiguous = key !== '' && duplicateKeys.has(key);
    let record = this._lookup(item, duplicateKeys);
    if (!record) {
      if (this._records.size >= this._capacity) {
        const evict = [...this._records.values()].find((entry) => !protectedIds.has(entry.itemId));
        if (!evict) fail('identity_capacity');
        this._forget(evict);
      }
      if (!Number.isSafeInteger(this._nextId)) fail('identity_sequence_exhausted');
      record = { itemId: this._nextId++, element: item.element, key, lastKnownKey: key, identityBasis: 'node_only',
        itemFractionMs: 0, regionFractionMs: 0, previouslyVisible: false };
    } else {
      if (this._nodes.get(record.element) === record.itemId) this._nodes.delete(record.element);
      if (record.key && this._hints.get(record.key) === record.itemId) this._hints.delete(record.key);
      this._records.delete(record.itemId);
    }
    record.element = item.element;
    record.key = key;
    if (key) record.lastKnownKey = key;
    record.identityBasis = ambiguous ? 'ambiguous_hint' : key ? 'content_hint' : 'node_only';
    this._nodes.set(item.element, record.itemId);
    if (key && !ambiguous) this._hints.set(key, record.itemId);
    this._records.set(record.itemId, record);
    protectedIds.add(record.itemId);
    return record;
  }

  sample({ at, epoch, layout, items }, { validUntil }) {
    if (!Number.isSafeInteger(epoch) || epoch < 1 || !LAYOUTS.has(layout)
      || !Number.isFinite(at) || at < 0 || !Number.isFinite(validUntil) || validUntil <= at
      || !Array.isArray(items) || items.length > 200) fail('sample');
    const nodes = new Set();
    const hintCounts = new Map();
    for (const item of items) {
      if (!item || typeof item.element !== 'object' || item.element === null || nodes.has(item.element)
        || typeof item.contentKey !== 'string'
        || !['measured', 'hidden', 'unavailable'].includes(item.geometryStatus)
        || !(item.itemFraction === null || fraction(item.itemFraction))
        || !(item.regionFraction === null || fraction(item.regionFraction))) fail('item');
      if (item.geometryStatus !== 'measured' && (item.itemFraction > 0 || item.regionFraction > 0)) fail('unmeasured_fraction');
      nodes.add(item.element);
      if (item.contentKey) hintCounts.set(item.contentKey, (hintCounts.get(item.contentKey) || 0) + 1);
    }
    const visible = items.filter((item) => item.itemFraction > 0 && item.regionFraction > 0);
    if (visible.length > this._capacity) fail('visible_capacity');
    if (this._epoch !== null && epoch < this._epoch) fail('epoch_reversed');
    this.advance(at);
    if (epoch !== this._epoch) this.reset({ epoch, at });
    this._hold = null;
    const duplicateKeys = new Set([...hintCounts].filter(([, count]) => count > 1).map(([key]) => key));
    for (const key of duplicateKeys) this._hints.delete(key);
    if (duplicateKeys.size > 0) this._totals.ambiguousHintSamples += 1;
    const protectedIds = new Set();
    for (const item of visible) {
      const record = this._lookup(item, duplicateKeys);
      if (record) protectedIds.add(record.itemId);
    }
    const previous = this._previous?.layout === layout ? this._previous : null;
    const previousIds = new Set(previous?.items.map((item) => item.itemId));
    const reenteredItemIds = [];
    const current = visible.map((item) => {
      const record = this._identify(item, duplicateKeys, protectedIds);
      if (previous !== null && !previousIds.has(record.itemId) && record.previouslyVisible) reenteredItemIds.push(record.itemId);
      record.previouslyVisible = true;
      return { itemId: record.itemId, identityBasis: record.identityBasis,
        itemFraction: item.itemFraction, regionFraction: item.regionFraction };
    });
    const currentIds = new Set(current.map((item) => item.itemId));
    const enteredItemIds = previous === null ? [] : current.filter((item) => !previousIds.has(item.itemId)).map((item) => item.itemId);
    const exitedItemIds = previous === null ? [] : previous.items.filter((item) => !currentIds.has(item.itemId)).map((item) => item.itemId);
    let change = previous === null ? 'baseline' : enteredItemIds.length || exitedItemIds.length ? 'visible_set_change' : 'unchanged';
    if (change === 'visible_set_change') {
      this._totals.sampledSetChanges += 1;
      if (layout === 'paged_item' && previous.items.length === 1 && current.length === 1
        && previous.items[0].identityBasis === 'content_hint' && current[0].identityBasis === 'content_hint') {
        change = 'single_item_change';
        this._totals.sampledSingleItemChanges += 1;
      }
    }
    this._totals.reentryObservations += reenteredItemIds.length;
    const ranked = [...current].sort((left, right) => right.regionFraction - left.regionFraction);
    const top = ranked[0];
    const margin = top ? top.regionFraction - (ranked[1]?.regionFraction || 0) : 0;
    const dominantItemId = top && margin > 0 ? top.itemId : null;
    const record = { kind: 'item_sample', at, epoch, previousSampleAt: previous?.at ?? null,
      continuity: previous !== null, layout, items: current, enteredItemIds, exitedItemIds,
      reenteredItemIds, dominantItemId, dominanceMargin: margin, change };
    this._previous = { at, validUntil, items: current, layout };
    this._hold = { validUntil, items: current };
    this._lastSample = structuredClone(record);
    return structuredClone(record);
  }

  getSnapshot({ now = this._at } = {}) {
    if (now !== null && (!Number.isFinite(now) || now < 0 || (this._at !== null && now < this._at))) fail('snapshot_clock');
    return { version: 1, epoch: this._epoch, at: this._at,
      status: this._hold === null ? 'unavailable' : now >= this._hold.validUntil ? 'stale' : 'sampled',
      basis: 'bounded_sampled_area_time_not_reading', capacity: this._capacity,
      ...this._totals, retainedIdentities: this._records.size,
      items: [...this._records.values()].map((record) => ({ itemId: record.itemId,
        identityBasis: record.identityBasis, itemFractionMs: record.itemFractionMs,
        regionFractionMs: record.regionFractionMs })),
      lastSample: this._lastSample === null ? null : structuredClone(this._lastSample),
      limitations: ['occlusion_unmeasured', 'hint_identity_not_content_proof',
        'revisit_support_limited_to_retained_identity', 'between_sample_transitions_unobserved'] };
  }
}
