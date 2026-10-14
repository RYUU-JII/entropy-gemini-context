import { SOCIAL_METRIC_ATTRS } from '../../../core/constants.js';
import { removeAttribute, setAttribute } from '../../FastStyleEngine.js';
import { collectMutationCausalRoots } from '../core/dirtyRootReducer.js';

// Exact instance-owned count/time effects. Public markers never confer ownership.
export function createTikTokMetricEffectOwner() {
  const records = new Map();
  const removedRoots = new Map();
  const dependencyScopes = new WeakMap();
  let removalRevision = 0;

  function forgetDependency(record) {
    if (!(record.dependencyScope instanceof Element)) return;
    const count = dependencyScopes.get(record.dependencyScope);
    if (!Number.isInteger(count) || count < 1) throw new Error('TIKTOK_METRIC_EFFECT_DEPENDENCY_RECORD_REQUIRED');
    if (count === 1) dependencyScopes.delete(record.dependencyScope);
    else dependencyScopes.set(record.dependencyScope, count - 1);
  }

  function restore(target) {
    const record = records.get(target);
    if (!record) return false;
    let changed = false;
    if (record.ownsMark && target.getAttribute(record.attr) === '1') changed = removeAttribute(target, record.attr) || changed;
    if (record.ownsCollapse && target.getAttribute(SOCIAL_METRIC_ATTRS.TIKTOK_COLLAPSE) === '1') {
      changed = removeAttribute(target, SOCIAL_METRIC_ATTRS.TIKTOK_COLLAPSE) || changed;
    }
    forgetDependency(record);
    records.delete(target);
    return changed;
  }

  function apply(target, metricTarget, ctx, info) {
    if (!(target instanceof Element) || !(metricTarget instanceof Element) || !ctx.isTikTok) {
      throw new Error('TIKTOK_METRIC_EFFECT_TARGET_REQUIRED');
    }
    const previous = records.get(target);
    let ownsMark = previous?.attr === ctx.attr && previous.ownsMark;
    let ownsCollapse = previous?.ownsCollapse === true;
    let changed = false;
    if (!target.hasAttribute(ctx.attr)) {
      setAttribute(target, ctx.attr, '1'); ownsMark = true; changed = true;
    }
    if (!target.hasAttribute(SOCIAL_METRIC_ATTRS.TIKTOK_COLLAPSE)) {
      setAttribute(target, SOCIAL_METRIC_ATTRS.TIKTOK_COLLAPSE, '1'); ownsCollapse = true; changed = true;
    }
    if (ownsMark || ownsCollapse) {
      const dependencyScope = info.dependencyScope instanceof Element ? info.dependencyScope : null;
      if (previous?.dependencyScope !== dependencyScope) {
        if (previous) forgetDependency(previous);
        if (dependencyScope) {
          const count = dependencyScopes.has(dependencyScope) ? dependencyScopes.get(dependencyScope) : 0;
          dependencyScopes.set(dependencyScope, count + 1);
        }
      }
      records.set(target, {
        target, metricTarget, attr: ctx.attr, group: ctx.group,
        key: info.key, kind: info.kind, ownsMark, ownsCollapse, dependencyScope,
      });
    }
    return changed;
  }

  function observeRemovals(payload, groups) {
    if (records.size === 0) return;
    for (const { group } of groups) {
      let roots = removedRoots.get(group);
      if (!roots) removedRoots.set(group, roots = new Map());
      for (const node of payload.removedNodes || []) {
        if (node instanceof Element) roots.set(node, ++removalRevision);
      }
    }
  }

  function createCursor(group, roots) {
    const detachedVersions = [...(removedRoots.get(group) || [])];
    const scopes = [...(roots === null ? [document.documentElement] : roots), ...detachedVersions.map(([scope]) => scope)];
    const seen = new Set();
    let index = 0, iterator = null, disconnected = null;
    function finish() {
      for (const [scope, revision] of detachedVersions) {
        const pending = removedRoots.get(group);
        if (pending?.get(scope) === revision) pending.delete(scope);
      }
      return { done: true };
    }
    return Object.freeze({
      next() {
        if (records.size === 0) return finish();
        const value = [];
        for (let visited = 0; visited < 32;) {
          if (!iterator) {
            if (index >= scopes.length) {
              // Mutable removed wrappers may be emptied. Actual removals alone
              // owe a cooperative disconnected owned-record pass.
              if (detachedVersions.length === 0) return value.length ? { done: false, value } : finish();
              if (!disconnected) disconnected = records.values();
              const step = disconnected.next();
              if (step.done) return value.length ? { done: false, value } : finish();
              visited += 1;
              const record = step.value;
              if (record.group !== group || seen.has(record.target)
                || (record.target.isConnected && record.metricTarget.isConnected)) continue;
              seen.add(record.target); value.push(record); continue;
            }
            const scope = scopes[index++];
            if (!(scope instanceof Element)) continue;
            iterator = scope.ownerDocument.createNodeIterator(scope, NodeFilter.SHOW_ELEMENT);
          }
          const target = iterator.nextNode();
          if (!target) { iterator = null; continue; }
          visited += 1;
          const record = records.get(target);
          if (record?.group !== group || seen.has(target)) continue;
          seen.add(target); value.push(record);
        }
        return { done: false, value };
      },
    });
  }

  function clearGroup(group) {
    for (const record of records.values()) {
      if (record.group === group) restore(record.target);
    }
    removedRoots.delete(group);
  }
  function collectMutationRoots(payload) {
    const scopes = new Set();
    // A removed comment marker is a sibling of its time/count; a revoked view
    // marker is a child of its projected indicator. Only an already-owned
    // dependency scope can widen that causal source to its direct parent.
    // Character-data and childList text replacement revoke the same edge.
    for (const target of collectMutationCausalRoots(payload)) {
      if (dependencyScopes.has(target.parentElement)) scopes.add(target.parentElement);
    }
    return [...scopes];
  }
  return Object.freeze({ apply, restore, createCursor, clearGroup, observeRemovals, collectMutationRoots,
    hasRecords: () => records.size > 0 });
}
