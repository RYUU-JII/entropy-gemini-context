import {
    applyShoulderPivotInto,
    clamp as clampValue,
    computeHydroDrag,
    computeTurnBiasedPectoralRates,
    suppressBackwardSlip,
} from './koiMotion.js';
import { DEFAULT_KOI_TUNING, PHYSICS_PROPS } from './constants.js';
import {
    normalizeKoiModelFeel,
    resolveKoiLocomotionMode,
    syncKoiLocomotionState,
} from './koiModelCalibration.js';
import { resolveKoiMovementBoundsFrame } from './koiSpatialBounds.js';
import { applyKinematicBodyPose, buildKinematicDebugInfo } from './koiDynamicsKinematicPose.js';

export function updateKoiFishKinematicHybrid(width, height, frameCount, isHovered, context = {}, helpers = {}) {
    const {
        wrapTurn,
        ensureBehaviorState,
        applyRefractoryDecay,
        computeAIDesiredHeading,
        clampLateralSlip,
        lerp,
        SWIM_MODEL_KINEMATIC_HYBRID,
    } = helpers;
    const cfg = this.tuning || DEFAULT_KOI_TUNING;
    const phys = cfg.physics || {};
    const speedScale = clampValue(cfg.speed ?? 1, 0.1, 2.5);
    const bounds = context.bounds || { width, height, padding: 58 };
    const originX = Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : 0;
    const originY = Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : 0;
    const center = context.center || { x: originX + bounds.width * 0.5, y: originY + bounds.height * 0.5 };
    const control = context.control || null;
    const manualControlActive = !!control?.active;
    const manualTurnIntent = clampValue(control?.turnIntent ?? 0, -1, 1);
    const manualForward = clampValue(control?.forward ?? 0, 0, 1);
    const manualBoost = !!control?.boost;
    const manualBrake = !!control?.brake;
    const manualHasInput = manualForward > 0 || manualBoost || manualBrake || Math.abs(manualTurnIntent) > 0;
    const sleepBlend = manualControlActive ? 0 : clampValue(context.sleepBlend ?? 0, 0, 1);
    const sleepMotionScale = 1 - sleepBlend * 0.9;
    const sleepTailScale = 1 - sleepBlend * 0.94;
    const sleepDriveScale = 1 - sleepBlend * 0.95;
    const sleepDrift = context.sleepDrift || null;
    const activityScale = clampValue(context.activityScale ?? 1, 0.35, 1.85);
    const globalActivityScale = clampValue(context.globalActivityScale ?? activityScale, 0.35, 1.85);
    const sleepActivityMultiplier = clampValue(
        context.sleepActivityMultiplier ?? (1 - sleepBlend * 0.92),
        0.06,
        1,
    );
    const simStepRateScale = clampValue(context.simStepRateScale ?? 1, 0.5, 2.5);
    const hoverStepScale = speedScale * activityScale * sleepMotionScale * simStepRateScale;
    const hoverMotion = typeof this.resolveHoverMotionState === 'function'
        ? this.resolveHoverMotionState(isHovered, hoverStepScale)
        : null;
    const hoverMotionScale = clampValue(hoverMotion?.motionScale ?? (isHovered ? 0.4 : 1.0), 0.4, 1);
    const hoverRhythmScale = clampValue(hoverMotion?.rhythmScale ?? (isHovered ? 0.62 : 1.0), 0.62, 1);
    const timeScale = hoverMotionScale * activityScale * sleepMotionScale;
    const simStepScale = speedScale * timeScale * simStepRateScale;
    this.manualControlActive = manualControlActive;
    this.sleepBlend = sleepBlend;

    this.configureSessionJitter(context.sessionSalt ?? 0);
    ensureBehaviorState(this, center);
    applyRefractoryDecay(this, simStepScale);

    const massScale = clampValue((this.baseSize || 15) / 15, 0.7, 2.5);
    const inertiaScale = 1 + (massScale - 1) * 0.65;
    const accel = (this.acceleration * (phys.accelScale ?? 1) * (this.speedMultiplier || 1)) / inertiaScale * simStepScale;
    const fric = Math.pow(this.friction * (phys.frictionScale ?? 1), simStepScale);
    const swimSpeedInput = clampValue(phys.swimSpeedScale ?? 1, 0.5, 8.0);
    const swimScale = Math.pow(swimSpeedInput, 0.84) * 0.64 * timeScale;
    const swimFrequencyGain = clampValue(0.78 + swimSpeedInput * 0.2, 0.72, 2.8);
    const finFlutterSpeed = clampValue(cfg.pectoralFlutterSpeed ?? 1.22, 0.1, 2.0);
    const stiffnessScale = clampValue(phys.spineStiffness ?? 1, 0.1, 8.0);
    const waveAmpScale = clampValue(phys.waveAmplitudeScale ?? 1, 0.2, 4.0);
    const wavelengthScale = clampValue(phys.wavelengthScale ?? 1, 1.0, 6.0);
    const coreSegment = clampValue(phys.coreSegment ?? 0.34, 0.0, 0.5);
    const hybridCurvatureGain = clampValue(phys.hybridCurvatureGain ?? 1, 0.2, 2.4);
    const hybridTurnResponse = clampValue(phys.hybridTurnResponse ?? 1, 0.2, 2.2);
    const hybridThrustGain = clampValue(phys.hybridThrustGain ?? 1, 0.2, 2.6);
    const hybridRearWaveGain = clampValue(phys.hybridRearWaveGain ?? 1, 0.2, 2.6);
    const hybridCounterYawGain = clampValue(phys.hybridCounterYawGain ?? 1, 0.1, 2.6);
    const hybridHeadSwayGain = clampValue(phys.hybridHeadSwayGain ?? 1, 0.2, 2.6);
    const aiWaveScale = clampValue(phys.aiWaveScale ?? 1, 0.1, 2.5);

    const currentSpeed = Math.hypot(this.velocity.x, this.velocity.y);
    const speedNorm = clampValue(currentSpeed / Math.max(1e-6, this.baseSpeed * 3.6), 0, 1);
    const wallSense = this.getWallSense(bounds, this.bodyHeading, this.x, this.y);
    const forwardSpeedRaw = this.velocity.x * Math.cos(this.bodyHeading) + this.velocity.y * Math.sin(this.bodyHeading);
    const forwardSpeed = Math.max(0, forwardSpeedRaw);
    const aiHeadingCadenceRaw = Number(phys.aiHeadingCadence);
    const aiHeadingCadence = Math.max(1, Math.round(Number.isFinite(aiHeadingCadenceRaw) ? aiHeadingCadenceRaw : 2));

    if (manualControlActive) {
        if (Math.abs(manualTurnIntent) > 0.001) {
            const steerGain = manualBoost ? 0.135 : 0.1;
            this.steerTargetAngle = wrapTurn(this.steerTargetAngle + manualTurnIntent * steerGain * simStepScale);
        } else {
            this.steerTargetAngle = this.lerpAngle(this.steerTargetAngle, this.bodyHeading, 0.2 * simStepScale);
        }
        this.aiHeadingFiltered = this.steerTargetAngle;
        if (this.aiHeadingSampleState) this.aiHeadingSampleState.nextFrame = -Infinity;
    } else {
        if (!this.aiHeadingSampleState) {
            const phaseSeed = ((this.uid || 1) * 0.7548776662466927) % 1;
            const phaseOffset = aiHeadingCadence > 1
                ? Math.floor(phaseSeed * aiHeadingCadence)
                : 0;
            this.aiHeadingSampleState = {
                nextFrame: frameCount + phaseOffset,
                cached: this.aiHeadingFiltered,
            };
        }
        const urgentHeadingSample = wallSense.near > 0.9 || wallSense.approachSpeed > 0.012;
        if (frameCount >= this.aiHeadingSampleState.nextFrame || urgentHeadingSample) {
            this.aiHeadingSampleState.cached = computeAIDesiredHeading(
                this,
                context,
                wallSense,
                simStepScale * aiHeadingCadence,
            );
            this.aiHeadingSampleState.nextFrame = frameCount + aiHeadingCadence;
        }
        const aiHeadingRaw = this.aiHeadingSampleState.cached;
        const aiHeadingFilter = clampValue(
            (0.07 + speedNorm * 0.2 + wallSense.near * 0.14) * simStepScale,
            0.05,
            0.42,
        );
        this.aiHeadingFiltered = this.lerpAngle(this.aiHeadingFiltered, aiHeadingRaw, aiHeadingFilter);
        const aiHeading = this.aiHeadingFiltered;
        const lowSpeedHeadingGate = clampValue((forwardSpeed - 0.004) / 0.024, 0, 1);
        const followRate = clampValue(
            (0.02 + wallSense.near * 0.08) * (0.3 + lowSpeedHeadingGate * 0.7) * simStepScale,
            0.006,
            0.3,
        );
        this.steerTargetAngle = this.lerpAngle(this.steerTargetAngle, aiHeading, followRate);
        if (lowSpeedHeadingGate < 0.32 && wallSense.near < 0.76) {
            this.steerTargetAngle = this.lerpAngle(this.steerTargetAngle, this.bodyHeading, 0.22 * simStepScale);
        }
    }

    const headingErrorRaw = wrapTurn(this.steerTargetAngle - this.bodyHeading);
    const headingDeadzone = manualControlActive ? 0.006 : (wallSense.near > 0.78 ? 0.015 : 0.05);
    const headingError = Math.abs(headingErrorRaw) >= headingDeadzone ? headingErrorRaw : 0;
    const turnNeed = clampValue(Math.abs(headingError) / Math.PI, 0, 1);
    const canRecoverSpin = !manualControlActive
        && (wallSense.near < 0.74 || wallSense.approachSpeed < 0.004);
    const spinRisk = canRecoverSpin && forwardSpeed < 0.012 && turnNeed > 0.14;
    if (spinRisk) this.spinStallTimer = Math.min(360, (this.spinStallTimer || 0) + simStepScale);
    else this.spinStallTimer = Math.max(0, (this.spinStallTimer || 0) - simStepScale * 1.8);
    const spinStalled = this.spinStallTimer > 30;
    if (spinStalled && canRecoverSpin && sleepBlend < 0.35) {
        this.steerTargetAngle = this.lerpAngle(this.steerTargetAngle, this.bodyHeading, 0.34 * simStepScale);
    }

    const turnAuthorityBase = (manualControlActive || wallSense.near > 0.84)
        ? 1
        : clampValue((forwardSpeed - 0.006) / 0.03, 0, 1);
    let turnAuthority = turnAuthorityBase;
    if (spinStalled && canRecoverSpin && sleepBlend < 0.35) {
        turnAuthority = Math.min(turnAuthority, 0.14);
    }

    let throttleTarget;
    if (manualControlActive) {
        if (manualBrake) throttleTarget = 0;
        else if (manualBoost) throttleTarget = 0.98;
        else if (manualForward > 0) throttleTarget = clampValue(0.14 + manualForward * 0.66, 0.12, 0.84);
        else throttleTarget = 0.24;
    } else {
        const cruiseComp = clampValue(0.42 - speedNorm, -0.22, 0.36);
        throttleTarget = clampValue(0.3 + cruiseComp * 0.42 + turnNeed * 0.06, 0.16, 0.82);
        if (wallSense.near > 0.74) throttleTarget *= 0.7;
        if (turnAuthorityBase < 0.34 && canRecoverSpin && sleepBlend < 0.35) throttleTarget = Math.max(throttleTarget, 0.42);
        if (spinStalled && canRecoverSpin && sleepBlend < 0.35) throttleTarget = Math.max(throttleTarget, 0.5);
        throttleTarget *= 1 - sleepBlend * 0.84;
    }

    const throttleFollow = throttleTarget > this.manualThrottle ? 0.22 : 0.14;
    this.manualThrottle = this.lerp(this.manualThrottle, clampValue(throttleTarget, 0, 1.04), throttleFollow);

    let brakeTarget = manualBrake ? 1 : 0;
    if (!manualControlActive && wallSense.near > 0.9) {
        brakeTarget = Math.max(brakeTarget, 0.1 + wallSense.near * 0.16);
    }
    this.brake = this.lerp(this.brake, brakeTarget, brakeTarget > this.brake ? 0.22 : 0.1);

    if (!Number.isFinite(this.kHybridPhase)) this.kHybridPhase = this.swimCycle || Math.random() * Math.PI * 2;
    if (!Number.isFinite(this.kHybridOmega)) this.kHybridOmega = 0.009 + swimScale * 0.005;
    if (!Number.isFinite(this.kHybridAmp)) this.kHybridAmp = 0.42;
    if (!Number.isFinite(this.kHybridCurvature)) this.kHybridCurvature = 0;

    const wallError = wrapTurn(wallSense.escapeAngle - this.bodyHeading);
    const wallBias = wallSense.near > 0.18
        ? wallError * (0.32 + wallSense.near * 0.86)
        : 0;
    const curvatureTarget = clampValue(
        (manualControlActive
            ? manualTurnIntent * 0.96 + headingError * 0.5
            : headingError * 0.58 + wallBias) * turnAuthority * hybridCurvatureGain,
        -1.3,
        1.3,
    );
    this.kHybridCurvature = lerp(
        this.kHybridCurvature,
        curvatureTarget,
        clampValue(0.2 * simStepScale * (0.7 + hybridTurnResponse * 0.3), 0.05, 0.5),
    );

    const ampTarget = clampValue(
        (
            0.24
            + this.manualThrottle * 0.56
            + turnNeed * 0.34
            + speedNorm * 0.16
        )
        * (0.74 + waveAmpScale * 0.32)
        * (0.2 + sleepTailScale * 0.8)
        * (0.82 + aiWaveScale * 0.28),
        0.04,
        1.46,
    );
    const omegaTarget = clampValue(
        (
            0.003
            + swimScale * 0.007
            + this.manualThrottle * 0.0058
            + turnNeed * 0.007
        ) * (0.78 + swimFrequencyGain * 0.18) * (0.2 + sleepTailScale * 0.8),
        0.001,
        0.08,
    );
    this.kHybridAmp = lerp(this.kHybridAmp, ampTarget, ampTarget > this.kHybridAmp ? 0.2 : 0.13);
    this.kHybridOmega = lerp(this.kHybridOmega, omegaTarget, clampValue(0.16 * simStepScale, 0.05, 0.32));
    this.kHybridPhase += this.kHybridOmega * simStepScale * hoverRhythmScale;
    this.swimCycle = this.kHybridPhase;

    const tailStroke = Math.sin(this.kHybridPhase);
    const tailStrokeVel = Math.cos(this.kHybridPhase) * this.kHybridOmega;
    const strokePower = Math.abs(tailStrokeVel) * (0.7 + this.kHybridAmp * 0.9);

    // Curvature command steers the fish; head follows with speed-gated turn cap.
    const desiredTurn = this.kHybridCurvature * (0.016 + this.kHybridAmp * 0.072) + headingError * 0.036;
    const turnResponse = clampValue(0.22 * simStepScale * hybridTurnResponse, 0.06, 0.46);
    this.turnRate = lerp(this.turnRate * 0.9, desiredTurn * turnAuthority, turnResponse);
    const turnCap = clampValue(
        (0.006 + turnAuthority * 0.058 * (0.84 + hybridTurnResponse * 0.32)) * (1 - speedNorm * 0.2),
        manualControlActive || wallSense.near > 0.84
            ? 0.009
            : (0.0016 + turnAuthority * 0.0082),
        0.1,
    );
    const actualTurn = clampValue(this.turnRate, -turnCap, turnCap);
    const headingBefore = this.bodyHeading;
    this.bodyHeading = wrapTurn(this.bodyHeading + actualTurn);
    this.turnRate = actualTurn;

    // Rotate around shoulder region, not pure head center, to avoid "ice limo" spin.
    const pivotOffset = this.segmentSpacing * (this.neckIndex + 1.05) * (0.22 + turnNeed * 0.35);
    const pivotScratch = this.shoulderPivotScratch || (this.shoulderPivotScratch = {
        x: this.x,
        y: this.y,
        pivot: { x: 0, y: 0 },
    });
    const pivotedHead = applyShoulderPivotInto(
        this.x,
        this.y,
        headingBefore,
        this.bodyHeading,
        pivotOffset,
        pivotScratch,
    );
    const pivotFollow = clampValue((0.18 + turnNeed * 0.34) * simStepScale, 0.08, 0.5);
    this.x = lerp(this.x, pivotedHead.x, pivotFollow);
    this.y = lerp(this.y, pivotedHead.y, pivotFollow);
    const shoulderBound = this.segmentSpacing * (0.52 + turnNeed * 0.22);
    const shoulderOffsetX = clampValue(pivotedHead.x - this.x, -shoulderBound, shoulderBound);
    const shoulderOffsetY = clampValue(pivotedHead.y - this.y, -shoulderBound, shoulderBound);

    const propulsionDelta = wrapTurn(this.bodyHeading - this.propulsionDir);
    this.propulsionDir = wrapTurn(
        this.propulsionDir + propulsionDelta * clampValue(0.34 + this.kHybridAmp * 0.24 + turnNeed * 0.24, 0.16, 0.82),
    );

    // Tail-driven thrust: propulsion is generated from stroke energy, not constant velocity.
    const throttleForce = (phys.throttleForce ?? PHYSICS_PROPS.throttleForce) * 0.92;
    let drive = accel * throttleForce * (0.004 + this.manualThrottle * 0.05);
    let thrust = accel * throttleForce * (
        0.002
        + strokePower * 0.065 * hybridThrustGain
        + Math.abs(this.kHybridCurvature) * 0.018 * (0.7 + hybridThrustGain * 0.3)
    ) * (0.8 + aiWaveScale * 0.2);
    // Reduce forward surge while turning to keep turn radius tighter.
    thrust *= 1 - clampValue(turnNeed * 0.12, 0, 0.18);
    if (manualControlActive && !manualHasInput && !manualBrake) {
        drive *= 0.26;
        thrust *= 0.2;
    }
    if (!manualControlActive && sleepBlend > 0.001) {
        drive *= sleepDriveScale;
        thrust *= sleepDriveScale * 0.9;
    }
    const netDrive = drive + thrust;
    const arcDrive = accel * throttleForce * (0.004 + turnNeed * 0.011) * (0.44 + this.manualThrottle * 0.6);

    // Head/body counter-yaw balances tail torque for less "torpedo" motion.
    const headCounterYaw = -tailStroke * (0.004 + this.kHybridAmp * 0.022) * hybridCounterYawGain;
    const flow = this.getFlowVector(width, height, frameCount);
    const flowGain = (manualControlActive ? 0.0035 : 0.0055) * simStepScale;
    const wobbledDir = this.propulsionDir + headCounterYaw * (0.72 + turnNeed * 0.44);
    this.velocity.x += Math.cos(wobbledDir) * netDrive + Math.cos(this.bodyHeading) * arcDrive + flow.x * flowGain;
    this.velocity.y += Math.sin(wobbledDir) * netDrive + Math.sin(this.bodyHeading) * arcDrive + flow.y * flowGain;
    if (!manualControlActive && sleepDrift && sleepBlend > 0.02) {
        this.velocity.x += sleepDrift.x;
        this.velocity.y += sleepDrift.y;
    }

    if (spinStalled && canRecoverSpin && sleepBlend < 0.35) {
        const recoveryKick = accel * (0.012 + this.manualThrottle * 0.03) * simStepScale;
        this.velocity.x += Math.cos(this.bodyHeading) * recoveryKick;
        this.velocity.y += Math.sin(this.bodyHeading) * recoveryKick;
    }

    if (this.brake > 0.001) {
        const speedMag = Math.hypot(this.velocity.x, this.velocity.y);
        if (speedMag > 1e-6) {
            const maxDecel = Math.min(speedMag, accel * PHYSICS_PROPS.brakeForce * this.brake);
            this.velocity.x -= (this.velocity.x / speedMag) * maxDecel;
            this.velocity.y -= (this.velocity.y / speedMag) * maxDecel;
        }
    }

    const wallPush = Math.pow(wallSense.near, 1.6) * (0.001 + wallSense.approachSpeed * 0.08);
    if (wallPush > 0) {
        this.velocity.x += wallSense.normal.x * wallPush;
        this.velocity.y += wallSense.normal.y * wallPush;
    }

    const forwardDamping = clampValue(
        fric * (0.987 + this.manualThrottle * 0.0032),
        0.964,
        0.999,
    );
    const lateralDamping = clampValue(
        0.52 + (1 - turnNeed) * 0.16 - this.kHybridAmp * 0.03,
        0.36,
        0.78,
    );
    const drag = computeHydroDrag({
        velocity: this.velocity,
        moveAngle: this.propulsionDir,
        forwardDamping,
        lateralDamping,
    });
    const minForward = manualControlActive
        ? (manualHasInput ? 0.00028 : 0)
        : 0.00025 + this.manualThrottle * 0.00055;
    const minDrive = manualControlActive
        ? (manualHasInput ? accel * 0.00065 : 0)
        : accel * (0.00035 + this.manualThrottle * 0.0008);
    const slip = suppressBackwardSlip({
        velocity: { x: drag.x, y: drag.y },
        heading: this.bodyHeading,
        minForward: minForward * simStepScale,
        recoverRate: 0.72 * simStepScale,
        maxRecover: 0.045 * simStepScale,
        minDrive: minDrive * simStepScale,
    });
    const slipLimitDeg = clampValue(4.8 + turnNeed * 1.4 + speedNorm * 0.6, 4.0, 7.8);
    const slipLimited = clampLateralSlip({ x: slip.x, y: slip.y }, this.bodyHeading, slipLimitDeg);
    this.velocity.x = slipLimited.x;
    this.velocity.y = slipLimited.y;
    // Keel-like lateral stabilization to reduce side-slip feel.
    {
        const fx = Math.cos(this.bodyHeading);
        const fy = Math.sin(this.bodyHeading);
        const lx = -fy;
        const ly = fx;
        const forwardComp = this.velocity.x * fx + this.velocity.y * fy;
        const lateralComp = this.velocity.x * lx + this.velocity.y * ly;
        const keelRecover = clampValue(
            (0.3 + speedNorm * 0.34 + turnNeed * 0.3) * simStepScale,
            0.1,
            0.72,
        );
        const lateralCorrected = lerp(lateralComp, 0, keelRecover);
        this.velocity.x = fx * forwardComp + lx * lateralCorrected;
        this.velocity.y = fy * forwardComp + ly * lateralCorrected;
    }

    const hardPad = Math.max(4, 6 + this.segmentSpacing * 0.55 + (this.baseSize || 15) * 0.24);
    const movementBounds = resolveKoiMovementBoundsFrame({ bounds, width, height, hardPad });
    let boundaryClamped = false;
    this.x += this.velocity.x * simStepScale;
    this.y += this.velocity.y * simStepScale;
    if (this.x < movementBounds.minX) {
        this.x = movementBounds.minX;
        boundaryClamped = true;
        if (this.velocity.x < 0) this.velocity.x *= -0.14;
    } else if (this.x > movementBounds.maxX) {
        this.x = movementBounds.maxX;
        boundaryClamped = true;
        if (this.velocity.x > 0) this.velocity.x *= -0.14;
    }
    if (this.y < movementBounds.minY) {
        this.y = movementBounds.minY;
        boundaryClamped = true;
        if (this.velocity.y < 0) this.velocity.y *= -0.14;
    } else if (this.y > movementBounds.maxY) {
        this.y = movementBounds.maxY;
        boundaryClamped = true;
        if (this.velocity.y > 0) this.velocity.y *= -0.14;
    }
    if (boundaryClamped && !manualControlActive) {
        const boundarySense = this.getWallSense(bounds, this.bodyHeading, this.x, this.y);
        const escapeAngle = boundarySense.escapeAngle;
        this.steerTargetAngle = this.lerpAngle(this.steerTargetAngle, escapeAngle, 0.58);
        this.aiHeadingFiltered = this.lerpAngle(this.aiHeadingFiltered, escapeAngle, 0.52);
        this.bodyHeading = this.lerpAngle(this.bodyHeading, escapeAngle, 0.2);
        this.propulsionDir = this.lerpAngle(this.propulsionDir, this.bodyHeading, 0.26);
        const inwardVelocity = this.velocity.x * boundarySense.normal.x + this.velocity.y * boundarySense.normal.y;
        if (inwardVelocity < 0.0025) {
            const recoverPush = (0.0028 + Math.abs(inwardVelocity) * 0.7) * simStepScale;
            this.velocity.x += boundarySense.normal.x * recoverPush;
            this.velocity.y += boundarySense.normal.y * recoverPush;
        }
        this.spinStallTimer = Math.max(0, (this.spinStallTimer || 0) - 8 * simStepScale);
    }

    const pose = applyKinematicBodyPose(this, {
        coreSegment,
        wavelengthScale,
        tailStroke,
        waveAmpScale,
        hybridHeadSwayGain,
        shoulderOffsetX,
        shoulderOffsetY,
        hybridRearWaveGain,
        aiWaveScale,
        stiffnessScale,
        wrapTurn,
        headCounterYaw,
    });
    const h = pose.history;
    const phaseTravel = pose.phaseTravel;
    const headLateralSway = pose.headLateralSway;

    const idleTarget = clampValue(0.58 - this.kHybridAmp * 0.32 + sleepBlend * 0.58, 0.06, 0.985);
    const waveTarget = clampValue((0.42 + this.kHybridAmp * 0.82) * (1 - sleepBlend * 0.94), 0.02, 1.0);
    this.tailIdleBlend = this.lerp(this.tailIdleBlend, idleTarget, 0.1);
    this.tailWaveBlend = this.lerp(this.tailWaveBlend, waveTarget, 0.1);

    const finBaseRate = clampValue(this.kHybridOmega, 0.002, 0.09) * 0.6;
    const finRates = computeTurnBiasedPectoralRates({
        baseRate: finBaseRate,
        turnRate: this.turnRate,
        turnThreshold: cfg.pectoralTurnThreshold,
        turnRateReference: cfg.pectoralTurnRateRef,
        driveRateBoost: cfg.pectoralTurnRateBoost,
        opposingRateMin: cfg.pectoralOpposingRateMin,
    });
    this.finPhaseL += finRates.rateL * speedScale * finFlutterSpeed * hoverRhythmScale;
    this.finPhaseR += finRates.rateR * speedScale * finFlutterSpeed * hoverRhythmScale;

    this.propulsionPhase += (
        this.wiggleSpeed * (0.12 + this.tailWaveBlend * 0.65)
        + this.kHybridOmega * (0.52 + this.kHybridAmp * 0.54)
        + currentSpeed * 0.006
    ) * simStepScale * hoverRhythmScale;
    this.shapePhase += (
        this.wiggleSpeed * (0.08 + this.tailWaveBlend * 0.52)
        + this.kHybridOmega * (0.46 + this.kHybridAmp * 0.38)
        + currentSpeed * 0.005
    ) * simStepScale * hoverRhythmScale;
    this.tailPhase = this.shapePhase;

    this.hoverScale = isHovered ? Math.min(1.15, this.hoverScale + 0.02) : Math.max(1, this.hoverScale - 0.02);
    this.labelOpacity = isHovered ? Math.min(1, this.labelOpacity + 0.1) : Math.max(0, this.labelOpacity - 0.05);
    this.tailPos = h[h.length - 1];
    this.lastSpeed = Math.hypot(this.velocity.x, this.velocity.y);

    let mode = 'cruise';
    if (manualBrake || wallSense.near > 0.9) mode = 'turn';
    else if (this.manualThrottle > 0.74 || manualBoost) mode = 'burst';
    else if (this.manualThrottle < 0.2) mode = 'glide';
    if (!manualControlActive && sleepBlend > 0.68) mode = 'sleep';
    const locomotionMode = resolveKoiLocomotionMode(mode, 'cruise');
    syncKoiLocomotionState(this, locomotionMode, { syncEventType: true });

    const normalized = normalizeKoiModelFeel(this, SWIM_MODEL_KINEMATIC_HYBRID, cfg, {
        locomotionMode,
        activationScore: activityScale,
        activityScale,
        globalActivityScale,
        sleepBlend,
        sleepActivityMultiplier,
        simStepScale,
    });

    this.debugInfo = buildKinematicDebugInfo({
        self: this,
        netDrive,
        flowGain,
        headingError,
        curvatureTarget,
        speedScale,
        simStepScale,
        finFlutterSpeed,
        swimSpeedInput,
        swimScale,
        waveAmpScale,
        wavelengthScale,
        stiffnessScale,
        phaseTravel,
        headLateralSway,
        slipDeg: slipLimited.slipDeg,
        slipLimitDeg,
        arcDrive,
        turnAuthority,
        hybridCurvatureGain,
        hybridTurnResponse,
        hybridThrustGain,
        hybridRearWaveGain,
        hybridCounterYawGain,
        hybridHeadSwayGain,
        normalized,
    });

    if (speedScale <= 0.001) {
        this.velocity.x = 0;
        this.velocity.y = 0;
    }

    this.angle = this.bodyHeading;
    const wake = this.surfaceWake;
    wake.stroke = Math.abs(tailStrokeVel) / this.kHybridOmega;
    wake.power = Math.min(1, strokePower / 0.06);
    wake.exitPower = 0;
    wake.side = tailStrokeVel;
    wake.powered = speedScale > 0.001 && !(manualControlActive && (!manualHasInput || manualBrake));
    wake.sharp = false;
    return this.getWakeSample(simStepScale);
}
