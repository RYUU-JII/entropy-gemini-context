let activeLease = null;

function requireProfileGeneration(value) {
  if (
    typeof value !== 'string'
    || !value.trim()
    || value.trim() !== value
  ) {
    throw new Error('DASHBOARD_PROFILE_GENERATION_REQUIRED');
  }
  return value;
}

export function acquireDashboardProfileGeneration(profileGeneration) {
  if (activeLease !== null) {
    throw new Error('DASHBOARD_PROFILE_GENERATION_ALREADY_ACQUIRED');
  }
  activeLease = Object.freeze({
    profileGeneration: requireProfileGeneration(profileGeneration),
  });
  return activeLease;
}

export function releaseDashboardProfileGeneration(lease) {
  if (lease === null || lease !== activeLease) {
    throw new Error('DASHBOARD_PROFILE_GENERATION_LEASE_STALE');
  }
  activeLease = null;
  return Object.freeze({ released: true });
}

export function requireDashboardProfileGeneration() {
  if (activeLease === null) {
    throw new Error('DASHBOARD_PROFILE_GENERATION_NOT_ADMITTED');
  }
  return activeLease.profileGeneration;
}
