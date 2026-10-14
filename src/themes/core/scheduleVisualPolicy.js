import { getThemePluginStrict } from './runtime/pluginCatalog.js';

export {
    SCHEDULE_RECIPE_VARIANTS,
    SCHEDULE_TEXTURE_BLEND_MODES,
    SCHEDULE_VISUAL_POLICY_SCHEMA_VERSION,
    resolveScheduleRecipeVariant,
} from './schedule/policyContract.js';

export function getScheduleVisualPolicy(themeId) {
    const plugin = getThemePluginStrict(themeId, 'schedule visual policy lookup');
    const policy = plugin.scheduleVisualPolicy;
    if (!policy || policy.themeId !== plugin.id) {
        throw new Error(`SCHEDULE_VISUAL_POLICY_REQUIRED:${plugin.id}`);
    }
    return policy;
}
