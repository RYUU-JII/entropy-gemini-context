function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function requireDashboardDestructiveActionAuthPolicy(
  value,
  {
    invalidErrorCode = 'DASHBOARD_DESTRUCTIVE_AUTH_POLICY_INVALID',
    requirePasscodeErrorCode = 'DASHBOARD_DESTRUCTIVE_AUTH_POLICY_REQUIRE_PASSCODE_INVALID',
  } = {},
) {
  if (!isPlainObject(value)) {
    throw new Error(invalidErrorCode);
  }
  if (typeof value.requirePasscode !== 'boolean') {
    throw new Error(requirePasscodeErrorCode);
  }
  return value;
}

export async function readDashboardDestructiveActionAuthPolicy(
  getDestructiveActionAuthPolicy,
  {
    ownerErrorCode = 'DASHBOARD_DESTRUCTIVE_AUTH_POLICY_OWNER_REQUIRED',
    invalidErrorCode = 'DASHBOARD_DESTRUCTIVE_AUTH_POLICY_INVALID',
    requirePasscodeErrorCode = 'DASHBOARD_DESTRUCTIVE_AUTH_POLICY_REQUIRE_PASSCODE_INVALID',
  } = {},
) {
  if (typeof getDestructiveActionAuthPolicy !== 'function') {
    throw new Error(ownerErrorCode);
  }
  return requireDashboardDestructiveActionAuthPolicy(
    await getDestructiveActionAuthPolicy(),
    {
      invalidErrorCode,
      requirePasscodeErrorCode,
    },
  );
}
