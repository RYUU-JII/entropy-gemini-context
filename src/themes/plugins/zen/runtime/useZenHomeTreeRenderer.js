import {
    useZenBonsaiMainWorkerRenderer,
} from './useZenBonsaiMainWorkerRenderer.js';
import {
    useZenTreeRenderer,
} from './useZenTreeRenderer.js';

const useDisabledRenderer = () => null;

const ZEN_HOME_RENDERER_HOOKS = Object.freeze({
    useMainWorkerRenderer: useZenBonsaiMainWorkerRenderer,
    useLocalPreviewRenderer: useDisabledRenderer,
    useAbRenderer: useDisabledRenderer,
});

export const useZenHomeTreeRenderer = (options) => (
    useZenTreeRenderer(options, ZEN_HOME_RENDERER_HOOKS)
);

export default useZenHomeTreeRenderer;
