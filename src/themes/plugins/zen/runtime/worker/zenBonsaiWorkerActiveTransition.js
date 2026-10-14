export const shouldResumeZenBonsaiRendererOnActiveTransition = ({
    wasActive = false,
    nextActive = false,
    renderer = null,
} = {}) => (
    nextActive === true
    && wasActive !== true
    && renderer
    && typeof renderer.resume === 'function'
);
