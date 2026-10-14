/** Full G15 study namespace, backed by the shared canonical Sakura ESM owner. */
import {
    SAKURA_CLUSTER_COMPOSITION_TEMPLATES,
    SAKURA_TERMINAL_BRANCHING_DEFAULTS,
    SAKURA_TERMINAL_CLUSTER_COVERAGE_DEFAULT,
    SAKURA_TERMINAL_KEYED_RANDOM_CONTRACT,
    SAKURA_TERMINAL_MORPHOLOGY_PLAN_CONTRACT,
    SAKURA_TERMINAL_MORPHOLOGY_PLAN_VERSION,
    SAKURA_TERMINAL_ORGAN_POSE_CONTRACT,
    SAKURA_TERMINAL_SOCKET_FIXTURES,
    createSakuraBlossomPose,
    createSakuraTerminalMorphologyPlan,
    createSakuraTerminalSocketStudyPlan,
    drawSakuraTwigPedicelStudy,
    paintProjectedSakuraBlossom,
    resolveProjectedBlossomAtlasDescriptor,
} from '../../sakura/lab/ZenSakuraTwigPedicelStudy.js';

const studyBindings = {
    SAKURA_CLUSTER_COMPOSITION_TEMPLATES,
    SAKURA_TERMINAL_BRANCHING_DEFAULTS,
    SAKURA_TERMINAL_CLUSTER_COVERAGE_DEFAULT,
    SAKURA_TERMINAL_KEYED_RANDOM_CONTRACT,
    SAKURA_TERMINAL_MORPHOLOGY_PLAN_CONTRACT,
    SAKURA_TERMINAL_MORPHOLOGY_PLAN_VERSION,
    SAKURA_TERMINAL_ORGAN_POSE_CONTRACT,
    SAKURA_TERMINAL_SOCKET_FIXTURES,
    createSakuraBlossomPose,
    createSakuraTerminalMorphologyPlan,
    createSakuraTerminalSocketStudyPlan,
    drawSakuraTwigPedicelStudy,
    paintProjectedSakuraBlossom,
    resolveProjectedBlossomAtlasDescriptor,
};

// Preserve the former generated namespace's plain, extensible CommonJS shape,
// including its non-enumerable marker, ordered read-only accessor properties.
const studyNamespace = {};
Object.defineProperty(studyNamespace, '__esModule', { value: true });
for (const key of Object.keys(studyBindings)) {
    Object.defineProperty(studyNamespace, key, {
        get: () => studyBindings[key],
        enumerable: true,
    });
}
globalThis.ZenSakuraTerminalMorphologyModule = studyNamespace;
