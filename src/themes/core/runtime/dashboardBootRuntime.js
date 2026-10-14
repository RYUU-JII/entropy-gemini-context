import {
    THEME_IDS,
    assertCanonicalThemeId,
} from '../ids.js';

const DASHBOARD_BOOT_RUNTIME_PREPARERS = Object.freeze({
    [THEME_IDS.MATRIX]: null,
    [THEME_IDS.ENTROPY]: null,
    [THEME_IDS.CYBERPUNK]: null,
    [THEME_IDS.CLINICAL]: null,
    [THEME_IDS.SCP]: null,
    [THEME_IDS.ZEN]: async () => {
        const runtime = await import(
            '../../plugins/zen/runtime/worker/ZenHomeRendererWorkerSession.js'
        );
        if (typeof runtime.prepareZenHomeRendererWorkerSession !== 'function') {
            throw new Error('ZEN_HOME_RENDERER_BOOT_PREPARE_OWNER_MISSING');
        }
        return runtime.prepareZenHomeRendererWorkerSession();
    },
});

export async function prepareDashboardThemeBootRuntime(themeId) {
    const canonicalThemeId = assertCanonicalThemeId(
        themeId,
        'dashboard theme boot runtime preparation',
    );
    const prepare = DASHBOARD_BOOT_RUNTIME_PREPARERS[canonicalThemeId];
    if (prepare === null) {
        return Object.freeze({
            themeId: canonicalThemeId,
            status: 'not_declared',
            reservationId: null,
            reservationState: null,
            release: null,
        });
    }
    if (typeof prepare !== 'function') {
        throw new Error(`DASHBOARD_THEME_BOOT_RUNTIME_CONTRACT_MISSING:${canonicalThemeId}`);
    }
    const reservation = await prepare();
    if (
        !reservation
        || typeof reservation.id !== 'string'
        || typeof reservation.state !== 'string'
        || typeof reservation.release !== 'function'
    ) {
        throw new Error(`DASHBOARD_THEME_BOOT_RUNTIME_RESERVATION_INVALID:${canonicalThemeId}`);
    }
    return Object.freeze({
        themeId: canonicalThemeId,
        status: 'started',
        reservationId: reservation.id,
        get reservationState() {
            return reservation.state;
        },
        release: reservation.release,
    });
}
