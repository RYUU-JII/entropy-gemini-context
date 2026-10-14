import {
  createFrictionThemeContext,
} from './context.js';
import {
  resolveRuntimeThemeId,
  resolveRuntimeThemeIdSync,
} from '../state/themePreferenceRepository.js';
import { resolveDisruptionVariant } from './variants/disruption/index.js';
import { resolveGatekeeperVariant } from './variants/gatekeeper/index.js';
import { resolveNudgeVariant } from './variants/nudge/index.js';

export { resolveRuntimeThemeId, resolveRuntimeThemeIdSync };

export function resolveGatekeeperTheme(themeId) {
  return resolveGatekeeperVariant(createFrictionThemeContext(themeId));
}

export function resolveDisruptionTheme(themeId) {
  return resolveDisruptionVariant(createFrictionThemeContext(themeId));
}

export function resolveNudgeThemeVariant(themeId) {
  return resolveNudgeVariant(createFrictionThemeContext(themeId));
}
