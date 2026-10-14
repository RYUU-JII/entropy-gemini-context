import { createRenderBudget } from '../../../../../platform/rendering/renderBudgetContract.js';

export const ZEN_APP_PETAL_RENDER_BUDGET = createRenderBudget({
    policyId: 'zen-app-petal-field-fixed',
    targetFps: 60,
    pixelRatioCap: 1.5,
    maxRenderPixels: 4_665_600,
});

export const MAX_ZEN_APP_PETALS = 48;
export const MAX_ZEN_PETAL_LANDING_BATCH = 24;
export const MAX_ZEN_PETAL_PENDING_BATCHES = 4;
