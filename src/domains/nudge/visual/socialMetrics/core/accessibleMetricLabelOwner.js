import { setAttribute } from '../../FastStyleEngine.js';
import { getMetricGroupForFilterKey } from '../contracts/socialMetricContracts.js';

// Attribute ownership only. Site adapters retain count meaning and discovery.
export function createAccessibleMetricLabelOwner() {
  const records = new Map();
  const removedRoots = new Map();
  let removalRevision = 0;
  function restore(target, record) {
    if (target.getAttribute('aria-label') === record.applied) {
      setAttribute(target, 'aria-label', record.original);
    }
    records.delete(target);
  }
  return Object.freeze({
    hasRecords: () => records.size > 0,
    hasPendingRemovals: () => removedRoots.size > 0,
    owns: (target) => records.has(target),
    restore(target) { const record = records.get(target); if (record) restore(target, record); },
    reconciliationDisposition(target, project, activeMetricKeys) {
      if (!target.isConnected) return 'clear';
      const current = target.getAttribute('aria-label');
      if (current === null) return 'clear';
      const previous = records.get(target);
      const source = previous && current === previous.applied ? previous.original : current;
      const projected = project(target, source, activeMetricKeys);
      return projected && projected.label !== source ? 'apply' : 'clear';
    },
    observeRemovals(payload) {
      if (records.size === 0) return;
      for (const root of payload.removedNodes || []) {
        if (root instanceof Element) removedRoots.set(root, ++removalRevision);
      }
    },
    createCursor(roots) {
      const detachedVersions = [...removedRoots];
      const scopes = [...(roots === null ? [document.documentElement] : roots), ...detachedVersions.map(([root]) => root)];
      let index = 0;
      let iterator = null;
      const seen = new Set();
      return {
        next() {
          const value = [];
          for (let visited = 0; visited < 32;) {
            if (!iterator) {
              if (index >= scopes.length || records.size === 0) {
                for (const [root, revision] of detachedVersions) {
                  if (removedRoots.get(root) === revision) removedRoots.delete(root);
                }
                return value.length ? { done: false, value } : { done: true };
              }
              const scope = scopes[index++];
              if (!(scope instanceof Element)) continue;
              iterator = scope.ownerDocument.createNodeIterator(scope, NodeFilter.SHOW_ELEMENT);
            }
            const target = iterator.nextNode();
            if (!target) { iterator = null; continue; }
            visited += 1;
            if (!records.has(target) || seen.has(target)) continue;
            seen.add(target);
            value.push(target);
          }
          return { done: false, value };
        },
      };
    },
    apply(target, project, activeMetricKeys) {
      if (!(target instanceof Element)) return null;
      const current = target.getAttribute('aria-label');
      if (current === null) {
        records.delete(target);
        return null;
      }
      const previous = records.get(target);
      const source = previous && current === previous.applied ? previous.original : current;
      const projected = project(target, source, activeMetricKeys);
      if (!projected) {
        if (previous) restore(target, previous);
        return null;
      }
      if (projected.label === source) {
        if (previous) restore(target, previous);
        return null;
      }
      records.set(target, {
        original: source, applied: projected.label,
        groups: new Set(projected.keys.map(getMetricGroupForFilterKey)),
      });
      const changed = setAttribute(target, 'aria-label', projected.label);
      return { target, changed, keys: projected.keys };
    },
    clearGroup(group) {
      for (const [target, record] of records) {
        if (record.groups.has(group)) restore(target, record);
      }
      if (records.size === 0) removedRoots.clear();
    },
  });
}
