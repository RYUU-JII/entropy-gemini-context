import { useMemo } from 'react';

import {
    ZEN_MAIN_WORKER_RENDER_BUDGET_POLICY_IDS,
    resolveZenMainWorkerRenderBudget,
} from './zenMainWorkerRenderBudget.js';

export function useZenMainWorkerRenderBudget({
    policyId = ZEN_MAIN_WORKER_RENDER_BUDGET_POLICY_IDS.FIXED_HOME,
    preset = 'full',
} = {}) {
    return useMemo(() => resolveZenMainWorkerRenderBudget({
        policyId,
        preset,
    }), [policyId, preset]);
}
