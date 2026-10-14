import { clamp } from './koiMotion.js';

export const createZenKoiSurfaceWake = () => ({
    stroke: 0, power: 0, exitPower: 0, side: 1, powered: false, sharp: false,
    strokeArmed: true, exitArmed: true, cooldown: 0,
});

export function resolveZenKoiSurfaceCoupling(depth) {
    if (!Number.isFinite(depth)) throw new Error('ZEN_KOI_WAKE_DEPTH_INVALID');
    const u = clamp((depth - 0.06) / 0.49, 0, 1);
    return 1 - u * u * (3 - 2 * u);
}

// Consume the propulsion owner's power signal after the new tail pose commits.
// Hysteresis admits one packet per half-stroke / departure sweep. It advances
// even underwater or coasting, so resurfacing cannot replay an old kick.
export function sampleZenKoiSurfaceWake(fish, stepScale) {
    const state = fish.surfaceWake;
    state.cooldown = Math.max(0, state.cooldown - stepScale);
    if (state.stroke < 0.3) state.strokeArmed = true;
    if (state.exitPower < 0.12) state.exitArmed = true;
    const strokeEdge = state.strokeArmed && state.stroke >= 0.72;
    const departure = state.exitArmed && state.exitPower >= 0.38;
    if (strokeEdge) state.strokeArmed = false;
    if (departure) state.exitArmed = false;
    if (!state.powered || !fish.tailPos) return null;
    const coupling = resolveZenKoiSurfaceCoupling(fish.depth);
    const sleep = clamp(fish.sleepBlend ?? 0, 0, 1);
    if (coupling <= 0 || (!fish.manualControlActive && sleep > 0.48)) return null;
    if (!departure && (!strokeEdge || state.sharp || state.cooldown > 0 || fish.lastSpeed < 0.06)) return null;
    const power = departure ? state.exitPower : state.power;
    if (power <= 0.08) return null;
    state.cooldown = 12;
    const wakeScale = clamp(fish.expressionProfile?.motion?.wakeScale ?? 1, 1, 1.22);
    // The field converts impulse to amplitude through sqrt: square coupling
    // here so the emitted surface amplitude fades continuously with depth.
    const force = clamp(
        (0.12 + fish.lastSpeed * 0.85) * (0.45 + power * 0.55)
        + (departure ? power * 0.7 : 0), 0, 1.22,
    ) * coupling * coupling * (1 - sleep * 0.82) * wakeScale;
    const angle = fish.tailPos.angle + Math.PI;
    const side = state.side < 0 ? -1 : 1;
    const offset = fish.baseSize * 0.32;
    return {
        x: fish.tailPos.x + Math.cos(angle) * offset - Math.sin(angle) * offset * side * 0.28,
        y: fish.tailPos.y + Math.sin(angle) * offset + Math.cos(angle) * offset * side * 0.28,
        force,
        style: 'wake',
    };
}
