import { validateSakuraLatent } from '../../model/v2/SakuraLatentSchema';

export const createZenClassicWorkspaceStateError = (
    code = 'ZEN_CLASSIC_WORKSPACE_LATENT_STATE_INVALID',
    message = 'Zen classic workspace latent state is invalid.',
    details = null,
    cause = null,
) => {
    const error = new Error(message);
    error.name = 'ZenClassicWorkspaceStateError';
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    if (cause) {
        error.cause = cause;
    }
    return error;
};

export const requireZenClassicWorkspaceLatent = (latent = null, field = 'latent') => {
    const resolvedField = field === 'learningAnchorLatent'
        ? 'learningAnchorLatent'
        : 'latent';
    try {
        return validateSakuraLatent(latent, {
            code: resolvedField === 'learningAnchorLatent'
                ? 'ZEN_CLASSIC_WORKSPACE_ANCHOR_LATENT_INVALID'
                : 'ZEN_CLASSIC_WORKSPACE_LATENT_INVALID',
            label: `Zen classic workspace ${resolvedField}`,
            details: {
                field: resolvedField,
            },
        });
    } catch (error) {
        throw createZenClassicWorkspaceStateError(
            error?.code || 'ZEN_CLASSIC_WORKSPACE_LATENT_STATE_INVALID',
            error?.message || `Zen classic workspace ${resolvedField} is invalid.`,
            error?.details || {
                field: resolvedField,
            },
            error instanceof Error ? error : null,
        );
    }
};

export const requireZenClassicWorkspaceLatentState = (state = null) => {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
        throw createZenClassicWorkspaceStateError(
            'ZEN_CLASSIC_WORKSPACE_LATENT_STATE_REQUIRED',
            'Zen classic workspace requires a canonical Sakura latent state object.',
        );
    }
    return {
        ...state,
        latent: requireZenClassicWorkspaceLatent(state?.latent, 'latent'),
        learningAnchorLatent: requireZenClassicWorkspaceLatent(
            state?.learningAnchorLatent,
            'learningAnchorLatent',
        ),
    };
};
