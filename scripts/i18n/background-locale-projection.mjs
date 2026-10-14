const NOTIFICATION_COPY_PATHS = Object.freeze([
  'notifications.journey_stage_advanced.title',
  'notifications.journey_stage_advanced.body',
  'notifications.isolation_session_started.title',
  'notifications.isolation_session_started.body',
  'notifications.isolation_session_ended.title',
  'notifications.isolation_session_ended.body',
  'notifications.global_cap_exceeded.title',
  'notifications.global_cap_exceeded.body',
  'notifications.schedule_window_started.title',
  'notifications.schedule_window_started.body',
  'notifications.schedule_window_ended.title',
  'notifications.schedule_window_ended.body',
]);

const SENTINEL_NUDGE_COPY_PATHS = Object.freeze([
  'sentinel_flare_protocol.combined_goals_title',
  'sentinel_flare_protocol.combined_goals_body',
  'sentinel_flare_protocol.body',
  'sentinel_flare_protocol.hint',
  'sentinel_flare_protocol.primary_cta',
  'sentinel_flare_protocol.primary_desc',
  'sentinel_flare_protocol.recovery_dashboard_body',
  'sentinel_flare_protocol.recovery_dashboard_body_global',
  'sentinel_flare_protocol.recovery_dashboard_primary_cta',
  'sentinel_flare_protocol.recovery_dashboard_primary_desc',
  'sentinel_flare_protocol.recovery_dashboard_secondary_cta',
  'sentinel_flare_protocol.recovery_dashboard_secondary_desc',
  'sentinel_flare_protocol.recovery_pause_body',
  'sentinel_flare_protocol.recovery_pause_body_global',
  'sentinel_flare_protocol.recovery_pause_primary_cta',
  'sentinel_flare_protocol.recovery_pause_primary_desc',
  'sentinel_flare_protocol.recovery_pause_secondary_cta',
  'sentinel_flare_protocol.recovery_pause_secondary_desc',
  'sentinel_flare_protocol.recovery_review_goal_body',
  'sentinel_flare_protocol.recovery_review_goal_body_global',
  'sentinel_flare_protocol.recovery_review_goal_primary_cta',
  'sentinel_flare_protocol.recovery_review_goal_primary_desc',
  'sentinel_flare_protocol.recovery_review_goal_secondary_cta',
  'sentinel_flare_protocol.recovery_review_goal_secondary_desc',
  'sentinel_flare_protocol.secondary_cta',
  'sentinel_flare_protocol.secondary_desc',
  'sentinel_flare_protocol.simulation_drift',
  'sentinel_flare_protocol.system_tag',
  'sentinel_flare_protocol.title',
  'sentinel_flare_protocol.title_localized',
]);

export const BACKGROUND_LOCALE_PROJECTION = Object.freeze({
  settings: NOTIFICATION_COPY_PATHS,
  tools: SENTINEL_NUDGE_COPY_PATHS,
});

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function readPath(target, pathSegments) {
  let current = target;
  for (const segment of pathSegments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function writePath(target, pathSegments, value) {
  let current = target;
  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index];
    if (!current[segment]) current[segment] = {};
    current = current[segment];
  }
  current[pathSegments.at(-1)] = value;
}

function deletePath(target, pathSegments) {
  let current = target;
  const parents = [];
  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index];
    parents.push({ parent: current, segment });
    current = current?.[segment];
    if (!current || typeof current !== 'object' || Array.isArray(current)) return;
  }
  delete current[pathSegments.at(-1)];
  for (let index = parents.length - 1; index >= 0; index -= 1) {
    const { parent, segment } = parents[index];
    const child = parent?.[segment];
    if (!child || typeof child !== 'object' || Array.isArray(child)) break;
    if (Object.keys(child).length > 0) break;
    delete parent[segment];
  }
}

function resolveContextPaths(namespaceResource, path) {
  const pathSegments = path.split('.');
  const leafName = pathSegments.at(-1);
  const parent = readPath(namespaceResource, pathSegments.slice(0, -1));
  if (!parent || typeof parent !== 'object' || Array.isArray(parent)) {
    throw new Error(`BACKGROUND_LOCALE_PROJECTION_PARENT_MISSING:${path}`);
  }
  return Object.keys(parent)
    .filter((key) => key === leafName || key.startsWith(`${leafName}_`))
    .map((key) => [...pathSegments.slice(0, -1), key]);
}

export function projectBackgroundLocaleResources(resourcesByNamespace) {
  const projected = {};

  for (const [namespace, paths] of Object.entries(BACKGROUND_LOCALE_PROJECTION)) {
    const namespaceResource = resourcesByNamespace?.[namespace];
    if (!namespaceResource || typeof namespaceResource !== 'object') {
      throw new Error(`BACKGROUND_LOCALE_PROJECTION_NAMESPACE_MISSING:${namespace}`);
    }
    projected[namespace] = {};
    for (const path of paths) {
      const resolvedPaths = resolveContextPaths(namespaceResource, path);
      if (resolvedPaths.length === 0) {
        throw new Error(`BACKGROUND_LOCALE_PROJECTION_COPY_MISSING:${namespace}:${path}`);
      }
      for (const pathSegments of resolvedPaths) {
        const copy = readPath(namespaceResource, pathSegments);
        if (typeof copy !== 'string') {
          throw new Error(
            `BACKGROUND_LOCALE_PROJECTION_COPY_INVALID:${namespace}:${pathSegments.join('.')}`,
          );
        }
        writePath(projected[namespace], pathSegments, copy);
      }
    }
  }

  return projected;
}

export function removeBackgroundProjectionFromNamespace(namespace, namespaceResource) {
  const remaining = cloneJsonValue(namespaceResource);
  const projectionPaths = BACKGROUND_LOCALE_PROJECTION[namespace] || [];
  for (const path of projectionPaths) {
    for (const pathSegments of resolveContextPaths(namespaceResource, path)) {
      deletePath(remaining, pathSegments);
    }
  }
  return remaining;
}
