import { clamp as clampValue } from './koiMotion.js';

const MODE_CRUISE = 'cruise';
const MODE_GLIDE = 'glide';
const MODE_BURST = 'burst';
const MODE_TURN = 'turn';
const MODE_C_TURN = 'c_turn';
const MODE_SLEEP = 'sleep';

const EVENT_NONE = 'none';
const EVENT_TURN = 'turn';
const EVENT_GLIDE = 'glide';
const EVENT_BURST = 'burst';
const EVENT_C_TURN = 'c_turn';

const LOCOMOTION_MODES = new Set([
    MODE_CRUISE,
    MODE_GLIDE,
    MODE_BURST,
    MODE_TURN,
    MODE_C_TURN,
    MODE_SLEEP,
]);

const MODEL_FEEL_PROFILE = Object.freeze({
    cpg_dynamics: Object.freeze({
        cruiseSpeedMul: 2.46,
        maxSpeedMul: 3.95,
        turnDamping: 0.9,
        turnCap: 0.082,
        slipLimitDeg: 9.4,
        tailBias: 1.0,
        throttleBias: 1.0,
    }),
    kinematic_hybrid: Object.freeze({
        cruiseSpeedMul: 2.4,
        maxSpeedMul: 3.9,
        turnDamping: 0.88,
        turnCap: 0.086,
        slipLimitDeg: 9.2,
        tailBias: 1.03,
        throttleBias: 0.99,
    }),
    // Calibrated against displacement after velocity correction. The previous
    // envelope was tuned while uncorrected velocity still moved the fish, so
    // fixing the integration order silently cut actual cruise travel by ~30%.
    event_fsm: Object.freeze({
        cruiseSpeedMul: 3.65,
        maxSpeedMul: 6.2,
        turnDamping: 0.9,
        turnCap: 0.088,
        slipLimitDeg: 9.3,
        tailBias: 0.98,
        throttleBias: 1.02,
    }),
    event_fsm_life_v1: Object.freeze({
        cruiseSpeedMul: 3.65,
        maxSpeedMul: 6.2,
        turnDamping: 0.9,
        turnCap: 0.088,
        slipLimitDeg: 9.3,
        tailBias: 0.98,
        throttleBias: 1.02,
    }),
    event_fsm_life_v2: Object.freeze({
        cruiseSpeedMul: 2.38,
        maxSpeedMul: 3.84,
        turnDamping: 0.92,
        turnCap: 0.082,
        slipLimitDeg: 8.6,
        tailBias: 1.04,
        throttleBias: 0.98,
    }),
});

function resolveFeelProfile(model) {
    return MODEL_FEEL_PROFILE[model] || MODEL_FEEL_PROFILE.cpg_dynamics;
}

export function resolveKoiModelTurnCap(model, mode) {
    return resolveFeelProfile(model).turnCap * (mode === MODE_C_TURN ? 1.48 : 0.9);
}

export function resolveKoiLocomotionMode(mode, fallback = MODE_CRUISE) {
    if (typeof mode !== 'string') return fallback;
    const normalized = mode.trim().toLowerCase();
    if (!normalized) return fallback;
    if (normalized === 'idle') return MODE_GLIDE;
    if (normalized === 'evade' || normalized === 'drift') return MODE_TURN;
    if (LOCOMOTION_MODES.has(normalized)) return normalized;
    return fallback;
}

export function mapKoiLocomotionModeToEventType(mode) {
    const resolvedMode = resolveKoiLocomotionMode(mode, MODE_CRUISE);
    if (resolvedMode === MODE_TURN) return EVENT_TURN;
    if (resolvedMode === MODE_C_TURN) return EVENT_C_TURN;
    if (resolvedMode === MODE_GLIDE) return EVENT_GLIDE;
    if (resolvedMode === MODE_BURST) return EVENT_BURST;
    return EVENT_NONE;
}

export function syncKoiLocomotionState(
    self,
    mode,
    {
        syncEventType = false,
        cTurnPhase = 'none',
    } = {},
) {
    if (!self || typeof self !== 'object') return MODE_CRUISE;
    const resolvedMode = resolveKoiLocomotionMode(mode, MODE_CRUISE);
    const eventType = mapKoiLocomotionModeToEventType(resolvedMode);

    self.actionState = resolvedMode;
    self.cTurnPhase = resolvedMode === MODE_C_TURN
        ? (typeof cTurnPhase === 'string' && cTurnPhase ? cTurnPhase : 'prepare')
        : 'none';

    if (syncEventType && self.eventState && typeof self.eventState === 'object') {
        self.eventState.type = eventType;
        if (eventType === EVENT_NONE) {
            self.eventState.timer = 0;
            self.eventState.duration = 0;
            self.eventState.sign = 0;
            self.eventState.strength = 1;
        }
    }

    const locomotionState = self.locomotionState && typeof self.locomotionState === 'object'
        ? self.locomotionState
        : {};
    locomotionState.mode = resolvedMode;
    locomotionState.eventType = eventType;
    locomotionState.sleeping = resolvedMode === MODE_SLEEP;
    self.locomotionState = locomotionState;

    return resolvedMode;
}

function clampLateralSlip(velocity, heading, slipLimitDeg = 10) {
    const fx = Math.cos(heading);
    const fy = Math.sin(heading);
    const lx = -fy;
    const ly = fx;
    const forward = velocity.x * fx + velocity.y * fy;
    const lateral = velocity.x * lx + velocity.y * ly;
    const baseForward = Math.max(0.012, Math.abs(forward));
    const maxLat = Math.tan((Math.max(0, slipLimitDeg) * Math.PI) / 180) * baseForward;
    const clampedLat = clampValue(lateral, -maxLat, maxLat);
    return {
        x: fx * forward + lx * clampedLat,
        y: fy * forward + ly * clampedLat,
        slipDeg: Math.abs(Math.atan2(clampedLat, baseForward) * (180 / Math.PI)),
    };
}

function resolveModeTargetMultiplier(mode) {
    const resolvedMode = resolveKoiLocomotionMode(mode, MODE_CRUISE);
    if (resolvedMode === MODE_BURST) return 1.32;
    if (resolvedMode === MODE_TURN || resolvedMode === MODE_C_TURN) return 0.94;
    if (resolvedMode === MODE_GLIDE) return 0.68;
    if (resolvedMode === MODE_SLEEP) return 0.34;
    return 1.0;
}

export function normalizeKoiModelFeel(self, model, tuning, runtime = {}) {
    const profile = resolveFeelProfile(model);
    const cfg = tuning || {};
    const phys = cfg.physics || {};
    const speedScale = clampValue(cfg.speed ?? 1, 0.1, 2.5);
    const swimSpeedInput = clampValue(phys.swimSpeedScale ?? 1, 0.5, 8.0);
    const baseSpeed = Math.max(1e-4, self.baseSpeed || 0.08);
    const mode = resolveKoiLocomotionMode(runtime.locomotionMode ?? self.actionState, MODE_CRUISE);
    const modeMul = resolveModeTargetMultiplier(mode);
    const activationScore = clampValue(runtime.activityScale ?? runtime.activationScore ?? 1, 0.06, 1.85);
    const globalActivityScale = clampValue(runtime.globalActivityScale ?? activationScore, 0.35, 1.85);
    const sleepBlend = clampValue(runtime.sleepBlend ?? self.sleepBlend ?? 0, 0, 1);
    const sleepActivityMultiplier = clampValue(
        runtime.sleepActivityMultiplier ?? (1 - sleepBlend * 0.92),
        0.06,
        1,
    );
    const wakeDrive = clampValue(1 - sleepBlend * 0.9, 0.06, 1);
    const sleepGate = mode === MODE_SLEEP
        ? clampValue(wakeDrive * 0.72, 0.06, 0.66)
        : clampValue(wakeDrive, 0.08, 1);
    const activityGain = activationScore;

    const cruiseTarget = baseSpeed
        * speedScale
        * (profile.cruiseSpeedMul * 0.46 + swimSpeedInput * 0.056);
    const modeTarget = cruiseTarget * modeMul * activityGain * sleepGate;
    const maxTarget = baseSpeed
        * speedScale
        * (profile.maxSpeedMul * 0.5 + swimSpeedInput * 0.072)
        * clampValue(0.62 + activationScore * 0.13, 0.5, 0.84);
    const minModeFloorMul = mode === MODE_SLEEP
        ? 0.04
        : (mode === MODE_GLIDE ? 0.22 : 0.42);
    const minTarget = Math.max(
        0,
        cruiseTarget
        * minModeFloorMul
        * sleepGate
        * clampValue(0.72 + activationScore * 0.28, 0.72, 1.25),
    );
    const safeMaxTarget = Math.max(maxTarget, minTarget * 1.05);
    const clampedTarget = clampValue(modeTarget, minTarget, safeMaxTarget);

    const speed = Math.hypot(self.velocity.x, self.velocity.y);
    if (speed > 1e-6) {
        let nextSpeed = speed;
        // The powered envelope is not a brake. A glide inherits the previous
        // stroke's momentum; hydrodynamic drag owns its decay, including above
        // the nominal cruise ceiling. Explicit braking remains in the integrator.
        if (speed > safeMaxTarget && mode !== MODE_GLIDE) {
            const overshoot = clampValue((speed - safeMaxTarget) / Math.max(1e-6, safeMaxTarget), 0, 2);
            const decay = clampValue(0.18 + overshoot * 0.2, 0.18, 0.56);
            nextSpeed = speed + (safeMaxTarget - speed) * decay;
        } else if (speed < minTarget && mode !== MODE_SLEEP && mode !== MODE_GLIDE
            && !(self.brake > 0.05)) {
            // Coasting/braking must dissipate momentum; a minimum-speed recovery
            // here would propel a fish even when its stroke model supplies no drive.
            const throttle = clampValue(self.manualThrottle ?? 0, 0, 1.08);
            const wakefulness = 1 - sleepBlend;
            const recoveryDrive = clampValue(
                0.18 + throttle * 0.42 + wakefulness * 0.26,
                0.12,
                0.72,
            );
            nextSpeed = speed + (clampedTarget - speed) * recoveryDrive * 0.18;
        }

        if (Math.abs(nextSpeed - speed) > 1e-6) {
            const scale = nextSpeed / speed;
            self.velocity.x *= scale;
            self.velocity.y *= scale;
        }
    }

    // The stroke executor integrates angular velocity over model time. Match
    // its angle units here; a per-update cap otherwise halves large turns at
    // half the update rate. Other rigs retain their declared per-update units.
    const { turnStepScale = 1 } = runtime;
    const turnCap = resolveKoiModelTurnCap(model, mode) * turnStepScale;
    if (Number.isFinite(self.turnRate)) {
        self.turnRate = clampValue(self.turnRate, -turnCap, turnCap);
    }

    const turnAbsDeg = Math.abs(self.turnRate || 0) * 180 / Math.PI;
    const slipBaseBoost = mode === MODE_C_TURN
        ? 3.2
        : (mode === MODE_TURN ? 1.9 : (mode === MODE_GLIDE ? 6 : 0.95));
    const slipLimitDeg = clampValue(
        profile.slipLimitDeg
        + slipBaseBoost
        + turnAbsDeg * (mode === MODE_C_TURN ? 0.15 : 0.085)
        + (activationScore - 1) * 1.3,
        profile.slipLimitDeg - 0.8,
        profile.slipLimitDeg + 8.0,
    );
    const slip = clampLateralSlip(self.velocity, self.bodyHeading, slipLimitDeg);
    const slipBlend = mode === MODE_C_TURN
        ? 0.42
        : (mode === MODE_TURN ? 0.32 : (mode === MODE_GLIDE ? 0.08 : 0.24));
    self.velocity.x += (slip.x - self.velocity.x) * slipBlend;
    self.velocity.y += (slip.y - self.velocity.y) * slipBlend;

    return {
        mode,
        activationScore,
        activityScale: activationScore,
        globalActivityScale,
        sleepBlend,
        sleepActivityMultiplier,
        targetSpeed: modeTarget,
        minTarget,
        maxTarget: safeMaxTarget,
        calibratedSpeed: Math.hypot(self.velocity.x, self.velocity.y),
        slipDeg: slip.slipDeg,
        slipLimitDeg,
    };
}
