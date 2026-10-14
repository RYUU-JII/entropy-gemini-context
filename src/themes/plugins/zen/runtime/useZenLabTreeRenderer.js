import {
    useZenBonsaiAbRenderer,
} from './useZenBonsaiAbRenderer.js';
import {
    useZenBonsaiLocalPreviewRenderer,
} from './useZenBonsaiLocalPreviewRenderer.js';
import {
    useZenTreeRenderer,
} from './useZenTreeRenderer.js';

const useDisabledRenderer = () => null;

const ZEN_LAB_RENDERER_HOOKS = Object.freeze({
    useMainWorkerRenderer: useDisabledRenderer,
    useLocalPreviewRenderer: useZenBonsaiLocalPreviewRenderer,
    useAbRenderer: useZenBonsaiAbRenderer,
});

export const useZenLabTreeRenderer = (options) => (
    useZenTreeRenderer(options, ZEN_LAB_RENDERER_HOOKS)
);

export default useZenLabTreeRenderer;
