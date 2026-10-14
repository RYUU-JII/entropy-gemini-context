import { evaluate } from '../../e2e/extensionChromiumHarness.mjs';

// Executed only within dashboard/capture's owned ephemeral extension page.
// The normal product UI owns every action; no runtime or storage shortcut.
export const openDashboardPondLab = (harness, page) => evaluate(harness.cdp, page.sessionId, `(async () => {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
        const entry = document.querySelector('button[data-experiment-section="pond"]');
        if (entry) { entry.click(); return; }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('QA_POND_LAB_ENTRY_MISSING');
})()`, { timeoutMs: 50000 });

export const runDashboardPondLabJourney = async (harness, page, captureSection) => {
    const sections = [];
    for (const section of ['scene', 'water', 'koi', 'inspect']) {
        const snapshot = await evaluate(harness.cdp, page.sessionId, `(async () => {
            const root = document.querySelector('[data-pond-lab]');
            const section = ${JSON.stringify(section)};
            const canvas = root.querySelector('canvas');
            const button = root.querySelector('button[data-pond-section="' + section + '"]');
            if (!button) throw new Error('QA_POND_LAB_SECTION_MISSING:' + section);
            button.click();
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            if (root.dataset.pondLabSection !== section || root.querySelector('canvas') !== canvas) throw new Error('QA_POND_LAB_SECTION_REMOUNT:' + section);
            const inspector = root.querySelector('aside').getBoundingClientRect();
            return { section, readiness: root.dataset.pondLabReadiness, sameCanvas: true, inspectorWidth: inspector.width };
        })()`, { timeoutMs: 10000 });
        await captureSection(section);
        sections.push(snapshot);
    }
    const controls = await evaluate(harness.cdp, page.sessionId, `(async () => {
        const root = document.querySelector('[data-pond-lab]');
        const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const click = selector => {
            const node = root.querySelector(selector);
            if (!node || node.disabled) throw new Error('QA_POND_LAB_CONTROL_UNAVAILABLE:' + selector);
            node.click();
        };
        const read = () => JSON.parse(root.dataset.pondLabControls);
        const canvas = root.querySelector('canvas');
        click('[data-pond-section="water"]'); await tick();
        const before = read();
        click('[data-pond-solo="rgbSplitEnabled"]'); await tick();
        const solo = read();
        if (!solo.rgbSplitEnabled || !solo.screenRefractionEnabled || solo.benthicEnabled) throw new Error('QA_POND_LAB_SOLO_INVALID');
        click('[data-pond-action="restore-effects"]'); await tick();
        if (JSON.stringify(read()) !== JSON.stringify(before)) throw new Error('QA_POND_LAB_RESTORE_MISMATCH');
        if (root.querySelector('canvas') !== canvas) throw new Error('QA_POND_LAB_EFFECT_REMOUNT');
        click('[data-pond-section="inspect"]'); await tick();
        click('[data-pond-action="hard-reset"]');
        const deadline = Date.now() + 45000;
        while (Date.now() < deadline) {
            if (root.dataset.pondLabReadiness === 'failed' || root.dataset.pondLabReset === 'failed') throw new Error('QA_POND_LAB_RESET_FAILED');
            if (root.dataset.pondLabReset === 'complete' && root.querySelector('canvas') !== canvas && root.dataset.pondLabReadiness === 'first_frame_committed') {
                return { before, solo, restored: true, reset: 'complete', firstFrameAfterReset: true, evidence: 'UI_requested_effects_and_renderer_first_frame_not_per_effect_GPU_proof' };
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('QA_POND_LAB_RESET_TIMEOUT:' + root.dataset.pondLabReadiness);
    })()`, { timeoutMs: 55000 });
    return { sections, controls };
};
