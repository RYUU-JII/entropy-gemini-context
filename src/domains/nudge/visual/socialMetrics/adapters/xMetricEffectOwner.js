// Effect ownership, not classification memory. Only successful applications may
// register a target; a public DOM marker is never sufficient to claim ownership.
export function createXMetricEffectOwner() {
  const records = new Map();
  const removedRoots = new Map();
  let removalRevision = 0;

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

  function remember(target, ctx) {
    if (!(target instanceof Element) || !ctx.isX) return;
    records.set(target, { target, group: ctx.group, attr: ctx.attr });
  }

  function forget(target) {
    records.delete(target);
  }

  function createCursor(group, roots) {
    // Initial/configuration scans have no previous targets after group cleanup.
    // A local mutation visits its own subtree, never the document-wide ledger.
    const detachedVersions = [...(removedRoots.get(group) || [])];
    const detachedScopes = detachedVersions.map(([scope]) => scope);
    const scopes = [...(roots === null ? [document.documentElement] : roots), ...detachedScopes];
    let scopeIndex = 0;
    let iterator = null;
    let disconnectedIterator = null;
    const seen = new Set();
    return {
      next() {
        const finish = () => {
          for (const [scope, revision] of detachedVersions) {
            const pending = removedRoots.get(group);
            if (pending?.get(scope) === revision) pending.delete(scope);
          }
          return { done: true };
        };
        if (records.size === 0) return finish();
        const value = [];
        let visited = 0;
        while (visited < 32) {
          if (!iterator) {
            if (scopeIndex >= scopes.length) {
              // A removed root can be emptied before deferred discovery. Only
              // actual removals owe a disconnected ownership-ledger pass.
              if (detachedVersions.length === 0) return value.length
                ? { done: false, value } : finish();
              if (!disconnectedIterator) disconnectedIterator = records.values();
              const step = disconnectedIterator.next();
              if (step.done) return value.length ? { done: false, value } : finish();
              visited += 1;
              const record = step.value;
              if (record.group !== group || record.target.isConnected || seen.has(record.target)) continue;
              seen.add(record.target);
              value.push(record);
              continue;
            }
            const scope = scopes[scopeIndex++];
            if (!(scope instanceof Element)) continue;
            iterator = scope.ownerDocument.createNodeIterator(scope, NodeFilter.SHOW_ELEMENT);
          }
          const target = iterator.nextNode();
          if (!target) {
            iterator = null;
            continue;
          }
          visited += 1;
          const record = records.get(target);
          if (record?.group !== group || seen.has(target)) continue;
          seen.add(target);
          value.push(record);
        }
        return { done: false, value };
      },
    };
  }

  function clearGroup(group, restore) {
    // Full enumeration is reserved for configuration/OFF, including detached
    // targets. Keep failed records so a subsequent cleanup can retry them.
    for (const record of records.values()) {
      if (record.group !== group) continue;
      try {
        restore(record);
      } catch (error) {
        records.set(record.target, record);
        throw error;
      }
      records.delete(record.target);
    }
    removedRoots.delete(group);
  }

  return Object.freeze({ remember, forget, createCursor, clearGroup, observeRemovals });
}
