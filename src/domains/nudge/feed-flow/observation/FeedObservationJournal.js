import { BoundedObservationJournal } from '../../../../lib/BoundedObservationJournal.js';

export const FEED_OBSERVATION_JOURNAL_MAX_CAPACITY = 256;
const MAX_VISIBLE_ITEMS = 200;
const COMMON_KEYS = ['kind', 'at', 'epoch'];
const SCROLL_KEYS = [...COMMON_KEYS, 'source', 'direction', 'screenfuls'];
const ITEM_SAMPLE_KEYS = [...COMMON_KEYS, 'previousSampleAt', 'continuity', 'layout', 'items',
  'enteredItemIds', 'exitedItemIds', 'reenteredItemIds', 'dominantItemId', 'dominanceMargin', 'change'];
const ITEM_KEYS = ['itemId', 'identityBasis', 'itemFraction', 'regionFraction'];
const LAYOUTS = new Set(['vertical_list', 'paged_item', 'grid']);
const IDENTITY_BASES = new Set(['content_hint', 'node_only', 'ambiguous_hint']);
const SAMPLE_CHANGES = new Set(['baseline', 'unchanged', 'visible_set_change', 'single_item_change']);

function fail(detail) { throw new Error(`FEED_OBSERVATION_JOURNAL_INVALID:${detail}`); }

function exactKeys(value, keys, detail) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(detail);
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail(detail);
  for (const key of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail(detail);
  }
}

function number(value, minimum, maximum, detail, { exclusiveMinimum = false } = {}) {
  if (!Number.isFinite(value) || value > maximum
    || (exclusiveMinimum ? value <= minimum : value < minimum)) fail(detail);
}

function positiveId(value, detail) {
  if (!Number.isSafeInteger(value) || value < 1) fail(detail);
}

function denseArray(value, detail) {
  if (!Array.isArray(value) || value.length > MAX_VISIBLE_ITEMS
    || Reflect.ownKeys(value).length !== value.length + 1) fail(detail);
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail(detail);
  }
}

function copyIds(value, detail) {
  denseArray(value, detail);
  for (const id of value) positiveId(id, detail);
  if (new Set(value).size !== value.length) fail(detail);
  return Object.freeze([...value]);
}

function copyRecord(record) {
  if (!record || typeof record !== 'object') fail('record');
  const kindDescriptor = Object.getOwnPropertyDescriptor(record, 'kind');
  if (!kindDescriptor || !Object.hasOwn(kindDescriptor, 'value')) fail('kind');
  const kind = kindDescriptor.value;
  if (kind === 'scroll_displacement') exactKeys(record, SCROLL_KEYS, 'scroll_keys');
  else if (kind === 'observation_gap') exactKeys(record, COMMON_KEYS, 'gap_keys');
  else if (kind === 'item_sample') exactKeys(record, ITEM_SAMPLE_KEYS, 'item_sample_keys');
  else fail('kind');
  number(record.at, 0, Number.POSITIVE_INFINITY, 'at');
  positiveId(record.epoch, 'epoch');
  const base = { kind, at: record.at, epoch: record.epoch };
  if (kind === 'observation_gap') return base;
  if (kind === 'scroll_displacement') {
    if (record.source !== 'unknown') fail('source');
    if (!['forward', 'backward'].includes(record.direction)) fail('direction');
    number(record.screenfuls, 0, Number.POSITIVE_INFINITY, 'screenfuls', { exclusiveMinimum: true });
    return { ...base, source: record.source, direction: record.direction, screenfuls: record.screenfuls };
  }
  if (typeof record.continuity !== 'boolean') fail('continuity');
  if (record.previousSampleAt !== null) number(record.previousSampleAt, 0, record.at, 'previous_sample_at');
  if (record.continuity && record.previousSampleAt === null) fail('continuity_without_previous_sample');
  if (!LAYOUTS.has(record.layout)) fail('layout');
  if (!SAMPLE_CHANGES.has(record.change)) fail('change');
  number(record.dominanceMargin, 0, 1, 'dominance_margin');
  denseArray(record.items, 'items');
  const items = record.items.map((item) => {
    exactKeys(item, ITEM_KEYS, 'item_keys');
    positiveId(item.itemId, 'item_id');
    if (!IDENTITY_BASES.has(item.identityBasis)) fail('identity_basis');
    number(item.itemFraction, 0, 1, 'item_fraction', { exclusiveMinimum: true });
    number(item.regionFraction, 0, 1, 'region_fraction', { exclusiveMinimum: true });
    return Object.freeze({ ...item });
  });
  const ids = new Set(items.map((item) => item.itemId));
  if (ids.size !== items.length) fail('duplicate_item_id');
  const enteredItemIds = copyIds(record.enteredItemIds, 'entered_item_ids');
  const exitedItemIds = copyIds(record.exitedItemIds, 'exited_item_ids');
  const reenteredItemIds = copyIds(record.reenteredItemIds, 'reentered_item_ids');
  if (enteredItemIds.some((id) => !ids.has(id))) fail('entered_item_not_visible');
  if (exitedItemIds.some((id) => ids.has(id))) fail('exited_item_still_visible');
  if (reenteredItemIds.some((id) => !enteredItemIds.includes(id))) fail('reentered_item_not_entered');
  if (record.dominantItemId !== null) {
    positiveId(record.dominantItemId, 'dominant_item_id');
    if (!ids.has(record.dominantItemId)) fail('dominant_item_not_visible');
  }
  return { ...base, previousSampleAt: record.previousSampleAt, continuity: record.continuity,
    layout: record.layout, items: Object.freeze(items), enteredItemIds, exitedItemIds, reenteredItemIds,
    dominantItemId: record.dominantItemId, dominanceMargin: record.dominanceMargin, change: record.change };
}

// The typed feed schema owns payloads; bounded sequence/retention has one owner.
export class FeedObservationJournal extends BoundedObservationJournal {
  constructor({ capacity = FEED_OBSERVATION_JOURNAL_MAX_CAPACITY } = {}) {
    super({ capacity, maximumCapacity: FEED_OBSERVATION_JOURNAL_MAX_CAPACITY, copyRecord, fail });
  }
}
export default FeedObservationJournal;
