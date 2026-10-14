import {
  createGateQaAutomationMessageRoutes,
} from './gateQaAutomationMessageRoutes.dev.js';
import { createInterventionCollisionQaMessageRoutes } from './interventionCollisionQaMessageRoutes.dev.js';
import {
  createRuntimeDebuggerAutomationMessageRoutes,
} from './runtimeDebuggerAutomationMessageRoutes.dev.js';
import {
  createAudioDullingQaMessageRoutes,
} from './audioDullingQaMessageRoutes.dev.js';
import {
  createSentinelProtocolQaAutomationMessageRoutes,
} from './sentinelProtocolQaAutomationMessageRoutes.dev.js';
import {
  createQaScenarioTabActivationMessageRoutes,
} from './qaScenarioTabActivationMessageRoutes.dev.js';
import {
  createVideoSkipControlSurfaceQaMessageRoutes,
} from './videoSkipControlSurfaceQaMessageRoutes.dev.js';
import { createSettingsPropagationQaFixtureMessageRoutes } from './settingsPropagationQaFixtureMessageRoutes.dev.js';
import { createGoalDeliveryQaFixtureMessageRoutes } from './goalDeliveryQaFixtureMessageRoutes.dev.js';

function mergeActions(...routeModules) {
  const actions = Object.create(null);
  routeModules.forEach((routeModule) => {
    Object.entries(routeModule?.actions || {}).forEach(([action, handler]) => {
      if (Object.prototype.hasOwnProperty.call(actions, action)) {
        throw new Error(`BUILD_CAPABILITY_ROUTE_DUPLICATE:${action}`);
      }
      actions[action] = handler;
    });
  });
  return actions;
}

export function createBuildCapabilityMessageRoutes(dependencies) {
  const audioDullingRoutes = createAudioDullingQaMessageRoutes(dependencies);
  return {
    actions: mergeActions(
      createRuntimeDebuggerAutomationMessageRoutes(dependencies),
      createGateQaAutomationMessageRoutes(dependencies),
      createInterventionCollisionQaMessageRoutes(dependencies),
      createSentinelProtocolQaAutomationMessageRoutes(dependencies),
      createVideoSkipControlSurfaceQaMessageRoutes(dependencies),
      createQaScenarioTabActivationMessageRoutes(dependencies),
      createSettingsPropagationQaFixtureMessageRoutes(dependencies),
      createGoalDeliveryQaFixtureMessageRoutes(dependencies),
      audioDullingRoutes,
    ),
    browserEvents: audioDullingRoutes.browserEvents,
  };
}

export default createBuildCapabilityMessageRoutes;
