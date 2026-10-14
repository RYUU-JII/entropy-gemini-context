export const QA_INITIAL_WINDOW_FOCUS_POLICIES = Object.freeze({
  REQUIRE_EXISTING_PAGE: 'require_existing_page',
  AGENT_ALLOW_ONCE_THEN_MINIMIZE: 'agent_allow_once_then_minimize',
  AGENT_PRESENT_ONCE: 'agent_present_once',
  HUMAN_PERMISSION_PRESENT_ONCE: 'human_permission_present_once',
});

export function allowsQaOwnedInitialWindowPresentation(plan = null) {
  const presentationPolicy = plan?.protocolOptions?.initialWindowPresentation;
  const declaredOwner = (plan?.mode === 'agent'
    && presentationPolicy === 'windows_agent_present_once')
    || (plan?.mode === 'human'
      && presentationPolicy === 'windows_human_permission_present_once'
      && plan.targetId === 'settings/permissions'
      && plan.protocolId === 'settings_permissions'
      && plan.environment?.id === 'ephemeral');
  return declaredOwner
    && plan.parameters?.allowInitialWindowFocusOnce === true
    && plan.environment?.processOwnership === 'owned'
    && plan.environment.lifecyclePolicy === 'per_run'
    && plan.browserExecution?.processOwnership === 'owned'
    && plan.browserExecution.presentation === 'foreground'
    && plan.browserExecution.headless === false
    && plan.browserExecution.documentVisibility === 'visible_required'
    && plan.browserExecution.targetActivation === 'active'
    && plan.browserExecution.osFocus === 'never';
}

export function requireQaOwnedInitialWindowPresentationPolicy(policy) {
  if (!['windows_agent_present_once', 'windows_human_permission_present_once'].includes(policy)) {
    throw new Error('QA_INITIAL_OWNED_WINDOW_PRESENTATION_POLICY_INVALID');
  }
  return policy;
}

export function resolveQaInitialWindowFocusPolicy(plan = null) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('QA_INITIAL_WINDOW_FOCUS_POLICY_PLAN_REQUIRED');
  }
  if (plan.browserExecution?.headless === true || plan.parameters?.presentation === 'hidden') {
    return QA_INITIAL_WINDOW_FOCUS_POLICIES.REQUIRE_EXISTING_PAGE;
  }
  const presentationPolicy = plan.protocolOptions?.initialWindowPresentation;
  if (['windows_agent_present_once', 'windows_human_permission_present_once'].includes(presentationPolicy)) {
    return allowsQaOwnedInitialWindowPresentation(plan)
      ? presentationPolicy === 'windows_human_permission_present_once'
        ? QA_INITIAL_WINDOW_FOCUS_POLICIES.HUMAN_PERMISSION_PRESENT_ONCE
        : QA_INITIAL_WINDOW_FOCUS_POLICIES.AGENT_PRESENT_ONCE
      : QA_INITIAL_WINDOW_FOCUS_POLICIES.REQUIRE_EXISTING_PAGE;
  }
  // Native animation may use an already visible passive window. Creating or
  // focusing a window would change the environment being measured.
  if (['document', 'animation'].includes(plan.browserObservation)) return QA_INITIAL_WINDOW_FOCUS_POLICIES.REQUIRE_EXISTING_PAGE;
  return plan.mode === 'agent'
    && plan.parameters?.allowInitialWindowFocusOnce === true
    ? plan.browserObservation === 'foreground'
      ? QA_INITIAL_WINDOW_FOCUS_POLICIES.AGENT_PRESENT_ONCE
      : QA_INITIAL_WINDOW_FOCUS_POLICIES.AGENT_ALLOW_ONCE_THEN_MINIMIZE
    : QA_INITIAL_WINDOW_FOCUS_POLICIES.REQUIRE_EXISTING_PAGE;
}

export function allowsQaInitialWindowFocusOnce(plan = null) {
  return resolveQaInitialWindowFocusPolicy(plan)
    !== QA_INITIAL_WINDOW_FOCUS_POLICIES.REQUIRE_EXISTING_PAGE;
}
