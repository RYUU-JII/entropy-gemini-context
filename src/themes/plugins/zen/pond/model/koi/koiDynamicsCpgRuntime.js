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
import { resolveSwimPreset } from './koiDynamicsPresets.js';
import { applyCpgBodyPose, buildCpgDebugInfo } from './koiDynamicsCpgPose.js';

export function updateKoiFishCpgDynamics(width, height, frameCount, isHovered, context = {}, helpers = {}) {
    const {
        wrapTurn,
        ensureBehaviorState,
        applyRefractoryDecay,
        computeAIDesiredHeading,
        clampLateralSlip,
        lerp,
        SWIM_MODEL_CPG_DYNAMICS,
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
    const swimScale = Math.pow(swimSpeedInput, 0.86) * 0.68 * timeScale;
    const swimFrequencyGain = clampValue(0.74 + swimSpeedInput * 0.22, 0.72, 2.6);
    const finFlutterSpeed = clampValue(cfg.pectoralFlutterSpeed ?? 1.22, 0.1, 2.0);
    const stiffnessScale = clampValue(phys.spineStiffness ?? 1, 0.1, 8.0);
    const waveAmpScale = clampValue(phys.waveAmplitudeScale ?? 1, 0.2, 4.0);
    const coreSegment = clampValue(phys.coreSegment ?? 0.34, 0.0, 0.5);

    const currentSpeed = Math.hypot(this.velocity.x, this.velocity.y);
    const speedNorm = clampValue(currentSpeed / Math.max(1e-6, this.baseSpeed * 3.6), 0, 1);
    const wallSense = this.getWallSense(bounds, this.bodyHeading, this.x, this.y);
    const forwardSpeedRaw = this.velocity.x * Math.cos(this.bodyHeading) + this.velocity.y * Math.sin(this.bodyHeading);
    const forwardSpeed = Math.max(0, forwardSpeedRaw);
    const aiHeadingCadenceRaw = Number(phys.aiHeadingCadence);
    const aiHeadingCadence = Math.max(1, Math.round(Number.isFinite(aiHeadingCadenceRaw) ? aiHeadingCadenceRaw : 2));

    this.turnStrokeCooldown = Math.max(0, this.turnStrokeCooldown - simStepScale);
    this.aiTurnStrokePulse = Math.max(0, this.aiTurnStrokePulse - 0.08 * simStepScale);

    if (manualControlActive) {
        if (Math.abs(manualTurnIntent) > 0.001) {
            const steerGain = manualBoost ? 0.14 : 0.11;
            this.steerTargetAngle = wrapTurn(this.steerTargetAngle + manualTurnIntent * steerGain * simStepScale);
        } else {
            this.steerTargetAngle = this.lerpAngle(this.steerTargetAngle, this.bodyHeading, 0.22 * simStepScale);
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
            (0.075 + speedNorm * 0.22 + wallSense.near * 0.16) * simStepScale,
            0.05,
            0.44,
        );
        this.aiHeadingFiltered = this.lerpAngle(this.aiHeadingFiltered, aiHeadingRaw, aiHeadingFilter);
        const aiHeading = this.aiHeadingFiltered;
        const lowSpeedHeadingGate = clampValue((forwardSpeed - 0.004) / 0.02, 0, 1);
        const followRate = clampValue(
            (0.02 + wallSense.near * 0.09) * (0.3 + lowSpeedHeadingGate * 0.7) * simStepScale,
            0.006,
            0.32,
        );
        this.steerTargetAngle = this.lerpAngle(this.steerTargetAngle, aiHeading, followRate);
        if (lowSpeedHeadingGate < 0.35 && wallSense.near < 0.72) {
            // Low-speed spin guard: reduce steering chase until forward motion recovers.
            this.steerTargetAngle = this.lerpAngle(this.steerTargetAngle, this.bodyHeading, 0.24 * simStepScale);
        }
    }

    const headingErrorRaw = wrapTurn(this.steerTargetAngle - this.bodyHeading);
    const headingDeadzone = manualControlActive ? 0.006 : (wallSense.near > 0.76 ? 0.014 : 0.045);
    const headingError = Math.abs(headingErrorRaw) >= headingDeadzone ? headingErrorRaw : 0;
    const turnNeed = clampValue(Math.abs(headingError) / Math.PI, 0, 1);
    const canRecoverSpin = !manualControlActive
        && (wallSense.near < 0.72 || wallSense.approachSpeed < 0.004);
    const spinRisk = canRecoverSpin
        && forwardSpeed < 0.012
        && turnNeed > 0.16;
    if (spinRisk) this.spinStallTimer = Math.min(360, (this.spinStallTimer || 0) + simStepScale);
    else this.spinStallTimer = Math.max(0, (this.spinStallTimer || 0) - simStepScale * 1.8);
    const spinStalled = this.spinStallTimer > 30;
    if (spinStalled && canRecoverSpin && sleepBlend < 0.35) {
        // Stop chasing far steering targets until forward motion is restored.
        this.steerTargetAngle = this.lerpAngle(this.steerTargetAngle, this.bodyHeading, 0.34 * simStepScale);
    }

    const turnAuthorityBase = (manualControlActive || wallSense.near > 0.82)
        ? 1
        : clampValue((forwardSpeed - 0.006) / 0.03, 0, 1);
    let turnAuthority = turnAuthorityBase;
    if (spinStalled && canRecoverSpin && sleepBlend < 0.35) {
        turnAuthority = Math.min(turnAuthority, 0.14);
    }
    const presetResolved = resolveSwimPreset(this, {
        manualControlActive,
        manualHasInput,
        manualBoost,
        manualBrake,
        manualTurnIntent,
        turnNeed,
        wallSense,
    });
    const presetState = presetResolved.state;
    const preset = presetResolved.preset;

    let throttleTarget;
    if (manualControlActive) {
        if (manualBrake) throttleTarget = 0;
        else if (manualBoost) throttleTarget = preset.throttleCeil;
        else if (manualForward > 0) {
            throttleTarget = clampValue(
                preset.throttleFloor + manualForward * (preset.throttleCeil - preset.throttleFloor),
                preset.throttleFloor,
                preset.throttleCeil,
            );
        } else {
            throttleTarget = preset.throttleBias;
        }
    } else {
        const cruiseComp = clampValue(0.42 - speedNorm, -0.25, 0.32);
        throttleTarget = clampValue(
            preset.throttleBias + cruiseComp * preset.speedCompGain,
            preset.throttleFloor,
            preset.throttleCeil,
        );
        if (wallSense.near > 0.72) throttleTarget *= 0.72;
        if (turnAuthorityBase < 0.35 && canRecoverSpin && sleepBlend < 0.35) {
            // At very low forward speed, force minimum forward intent to break in-place spin.
            throttleTarget = Math.max(throttleTarget, preset.throttleBias + 0.12);
        }
        if (spinStalled && canRecoverSpin && sleepBlend < 0.35) {
            throttleTarget = Math.max(throttleTarget, preset.throttleBias + 0.2);
        }
        throttleTarget *= 1 - sleepBlend * 0.84;
    }
    throttleTarget = clampValue(throttleTarget, 0, 1.06);

    const throttleRise = preset.throttleRise ?? PHYSICS_PROPS.throttleRise ?? 0.24;
    const throttleFall = preset.throttleFall ?? PHYSICS_PROPS.throttleFall ?? 0.12;
    const throttleFollow = throttleTarget > this.manualThrottle ? throttleRise : throttleFall;
    this.manualThrottle = this.lerp(this.manualThrottle, throttleTarget, throttleFollow);

    let brakeTarget = manualBrake ? 1 : 0;
    if (!manualControlActive && wallSense.near > 0.9) {
        brakeTarget = Math.max(brakeTarget, 0.12 + wallSense.near * 0.16);
    }
    this.brake = this.lerp(this.brake, brakeTarget, brakeTarget > this.brake ? 0.22 : 0.1);

    if (!Number.isFinite(this.cpgPhase)) this.cpgPhase = this.swimCycle || Math.random() * Math.PI * 2;
    if (!Number.isFinite(this.cpgOmega)) this.cpgOmega = 0.012 + swimScale * 0.006;
    if (!Number.isFinite(this.cpgAmplitude)) this.cpgAmplitude = 0.34;
    if (!Number.isFinite(this.cpgCurvature)) this.cpgCurvature = 0;

    let kappaRef;
    if (manualControlActive) {
        kappaRef = manualTurnIntent * preset.curvatureInputGain + headingError * preset.curvatureHeadingGain;
    } else {
        const wallError = wrapTurn(wallSense.escapeAngle - this.bodyHeading);
        const wallBias = wallSense.near > 0.18
            ? wallError * preset.curvatureWallGain * (0.3 + wallSense.near * 0.7)
            : 0;
        kappaRef = headingError * preset.curvatureHeadingGain + wallBias;
    }
    kappaRef = clampValue(kappaRef * turnAuthority, -preset.curvatureLimit, preset.curvatureLimit);
    const curvatureFollow = clampValue(preset.curvatureResponse * simStepScale, 0.04, 0.46);
    this.cpgCurvature = lerp(this.cpgCurvature, kappaRef, curvatureFollow);

    const ampTarget = clampValue(
        (preset.ampBase + this.manualThrottle * preset.ampThrottleGain + turnNeed * preset.ampTurnGain)
        * (0.74 + waveAmpScale * 0.26)
        * (0.2 + sleepTailScale * 0.8)
        * preset.ampScale,
        0.03,
        1.35,
    );
    const omegaTarget = clampValue(
        (
            preset.omegaBase
            + swimScale * preset.omegaSwimGain
            + this.manualThrottle * preset.omegaThrottleGain
            + turnNeed * preset.omegaTurnGain
        ) * (0.74 + swimFrequencyGain * 0.22) * preset.omegaScale * (0.2 + sleepTailScale * 0.8),
        0.0012,
        0.09,
    );
    this.cpgAmplitude = lerp(
        this.cpgAmplitude,
        ampTarget,
        ampTarget > this.cpgAmplitude ? preset.ampRise : preset.ampFall,
    );
    this.cpgOmega = lerp(this.cpgOmega, omegaTarget, clampValue(preset.omegaResponse * simStepScale, 0.06, 0.4));

    const cycleRate = clampValue(this.cpgOmega, 0.0022, 0.09);
    this.cpgPhase += cycleRate * simStepScale * hoverRhythmScale;
    this.swimCycle = this.cpgPhase;

    const strokeSin = Math.sin(this.swimCycle);
    const stroke = 0.5 + 0.5 * strokeSin;
    let idleTarget = clampValue(0.72 - this.cpgAmplitude * 0.62, 0.06, 0.85);
    let waveTarget = clampValue(0.24 + this.cpgAmplitude * 0.72 + turnNeed * 0.12, 0.12, 0.98);
    if (manualControlActive && !manualHasInput && !manualBrake) {
        idleTarget = 0.92;
        waveTarget = 0.12;
    }
    idleTarget = clampValue(idleTarget + sleepBlend * 0.58, 0.06, 0.985);
    waveTarget = clampValue(waveTarget * (1 - sleepBlend * 0.94), 0.02, 0.98);
    this.tailIdleBlend = this.lerp(this.tailIdleBlend, idleTarget, idleTarget > this.tailIdleBlend ? 0.12 : 0.09);
    this.tailWaveBlend = this.lerp(this.tailWaveBlend, waveTarget, waveTarget > this.tailWaveBlend ? 0.11 : 0.08);

    const tailMotionGate = 1 - this.tailIdleBlend * 0.86;
    const thrustPulse = clampValue((0.1 + stroke * 0.9) * (0.64 + this.cpgAmplitude * 0.36), 0, 1);

    const desiredTurn = this.cpgCurvature * (preset.turnGainBase + this.cpgAmplitude * preset.turnGainAmp)
        + headingError * preset.turnErrorGain;
    const oscillatoryTurn = Math.sin(this.swimCycle - Math.PI * 0.5)
        * this.cpgCurvature
        * (preset.turnOscGain + this.cpgAmplitude * 0.007);
    const turnResponse = manualControlActive
        ? clampValue(preset.turnRateResponse * 1.1, 0.08, 0.5)
        : clampValue(preset.turnRateResponse * simStepScale, 0.06, 0.4);
    this.turnRate = lerp(
        this.turnRate * preset.turnDamping,
        (desiredTurn + oscillatoryTurn) * turnAuthority,
        turnResponse,
    );
    const turnCap = clampValue(
        (preset.turnCapBase + turnNeed * preset.turnCapGain) * (1 - speedNorm * 0.2) * (0.34 + turnAuthority * 0.66),
        manualControlActive || wallSense.near > 0.82
            ? 0.008
            : (0.0006 + turnAuthority * 0.0048),
        preset.turnCapMax,
    );
    const actualTurn = clampValue(this.turnRate, -turnCap, turnCap);
    const headingBefore = this.bodyHeading;
    this.bodyHeading = wrapTurn(this.bodyHeading + actualTurn);
    this.turnRate = actualTurn;

    const pivotOffset = this.segmentSpacing * (this.neckIndex + 0.9) * (0.16 + turnNeed * 0.26);
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
    const pivotFollow = clampValue((0.14 + turnNeed * 0.28) * simStepScale, 0.07, 0.42);
    this.x = lerp(this.x, pivotedHead.x, pivotFollow);
    this.y = lerp(this.y, pivotedHead.y, pivotFollow);
    const shoulderBound = this.segmentSpacing * (0.45 + turnNeed * 0.12);
    const shoulderOffsetX = clampValue(pivotedHead.x - this.x, -shoulderBound, shoulderBound);
    const shoulderOffsetY = clampValue(pivotedHead.y - this.y, -shoulderBound, shoulderBound);

    const propulsionDelta = wrapTurn(this.bodyHeading - this.propulsionDir);
    const propulsionFollow = clampValue(
        preset.propulsionFollowBase + this.cpgAmplitude * preset.propulsionFollowAmp + turnNeed * preset.propulsionFollowTurn,
        0.1,
        0.62,
    );
    this.propulsionDir = wrapTurn(this.propulsionDir + propulsionDelta * propulsionFollow);

    const finBaseRate = cycleRate * 0.5;
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
        this.wiggleSpeed * (0.1 + tailMotionGate * 0.68)
        + cycleRate * (0.62 + this.cpgAmplitude * 0.5)
        + currentSpeed * 0.007
    ) * simStepScale * hoverRhythmScale;
    this.shapePhase += (
        this.wiggleSpeed * (0.08 + tailMotionGate * 0.5)
        + cycleRate * (0.5 + this.cpgAmplitude * 0.34)
        + currentSpeed * 0.006
    ) * simStepScale * hoverRhythmScale;
    this.tailPhase = this.shapePhase;

    const recoilForce = Math.sin(this.propulsionPhase - (0.2 + this.depth * 0.08));
    const headYaw = recoilForce
        * (0.003 + this.cpgAmplitude * 0.018 + turnNeed * 0.009 + speedNorm * 0.004)
        * preset.headYawScale;
    const bodyRecoil = recoilForce * (0.0008 + this.cpgAmplitude * 0.0028) * tailMotionGate;
    this.bodyHeading = wrapTurn(this.bodyHeading + bodyRecoil * preset.recoilHeadingGain);
    this.propulsionDir = wrapTurn(this.propulsionDir + bodyRecoil * preset.recoilPropGain);

    const throttleForce = (phys.throttleForce ?? PHYSICS_PROPS.throttleForce) * preset.forceScale;
    let drive = accel * throttleForce * (preset.driveBase + this.manualThrottle * preset.driveThrottle);
    let thrust = accel * throttleForce * (preset.thrustBase + this.cpgAmplitude * preset.thrustAmp) * thrustPulse;
    thrust += accel * throttleForce * Math.abs(this.cpgCurvature) * (preset.thrustTurnBase + stroke * preset.thrustTurnStroke);
    if (manualControlActive && !manualHasInput && !manualBrake) {
        drive *= 0.24;
        thrust *= 0.16;
    }
    if (!manualControlActive && sleepBlend > 0.001) {
        drive *= sleepDriveScale;
        thrust *= sleepDriveScale * 0.9;
    }

    const flow = this.getFlowVector(width, height, frameCount);
    const flowGain = (manualControlActive ? preset.flowGainManual : preset.flowGainAI) * simStepScale;
    const netDrive = drive + thrust;
    const wobbledDir = this.propulsionDir + headYaw * (0.28 + speedNorm * 0.16);

    this.velocity.x += Math.cos(wobbledDir) * netDrive + flow.x * flowGain;
    this.velocity.y += Math.sin(wobbledDir) * netDrive + flow.y * flowGain;
    if (!manualControlActive && sleepDrift && sleepBlend > 0.02) {
        this.velocity.x += sleepDrift.x;
        this.velocity.y += sleepDrift.y;
    }
    if (spinStalled && canRecoverSpin && sleepBlend < 0.35) {
        // Low-speed recovery impulse to break pure yaw loops.
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

    const targetBanking = -this.turnRate * 2.5;
    this.banking = lerp(this.banking || 0, targetBanking, 0.08);

    const wallPush = Math.pow(wallSense.near, 1.6) * (0.001 + wallSense.approachSpeed * 0.08);
    if (wallPush > 0) {
        this.velocity.x += wallSense.normal.x * wallPush;
        this.velocity.y += wallSense.normal.y * wallPush;
    }

    const sizeDampingGain = (massScale - 1) * 0.008;
    const forwardDamping = clampValue(
        fric * (preset.forwardDampingBase + sizeDampingGain + this.manualThrottle * preset.forwardDampingThrottle),
        0.966,
        0.999,
    );
    const lateralDamping = clampValue(
        preset.lateralDampingBase + (1 - turnNeed) * preset.lateralDampingTurn - this.cpgAmplitude * preset.lateralDampingAmp,
        0.54,
        0.92,
    );

    const drag = computeHydroDrag({
        velocity: this.velocity,
        moveAngle: this.propulsionDir,
        forwardDamping,
        lateralDamping,
    });

    const minForward = manualControlActive
        ? (manualHasInput ? 0.00032 : 0)
        : 0.00025 + this.manualThrottle * 0.00055;
    const minDrive = manualControlActive
        ? (manualHasInput ? accel * 0.0007 : 0)
        : accel * (0.00035 + this.manualThrottle * 0.0008);
    const slip = suppressBackwardSlip({
        velocity: { x: drag.x, y: drag.y },
        heading: this.bodyHeading,
        minForward: minForward * simStepScale,
        recoverRate: 0.72 * simStepScale,
        maxRecover: 0.045 * simStepScale,
        minDrive: minDrive * simStepScale,
    });
    const slipLimited = clampLateralSlip({ x: slip.x, y: slip.y }, this.bodyHeading, preset.slipLimitDeg);
    this.velocity.x = slipLimited.x;
    this.velocity.y = slipLimited.y;

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

    const pose = applyCpgBodyPose(this, {
        coreSegment,
        phys,
        turnNeed,
        waveAmpScale,
        inertiaScale,
        speedNorm,
        stroke,
        swimFrequencyGain,
        headYaw,
        shoulderOffsetX,
        shoulderOffsetY,
        wrapTurn,
        stiffnessScale,
    });
    const h = pose.history;
    const phaseTravel = pose.phaseTravel;
    const waveLengthScale = pose.waveLengthScale;
    const headLateralSway = pose.headLateralSway;

    this.hoverScale = isHovered ? Math.min(1.15, this.hoverScale + 0.02) : Math.max(1, this.hoverScale - 0.02);
    this.labelOpacity = isHovered ? Math.min(1, this.labelOpacity + 0.1) : Math.max(0, this.labelOpacity - 0.05);
    this.tailPos = h[h.length - 1];
    this.lastSpeed = Math.hypot(this.velocity.x, this.velocity.y);

    let mode = presetState;
    if (mode === 'idle') mode = 'glide';
    if (mode === 'evade') mode = 'turn';
    if (!manualControlActive && sleepBlend > 0.68) mode = 'sleep';
    const locomotionMode = resolveKoiLocomotionMode(mode, 'cruise');
    syncKoiLocomotionState(this, locomotionMode, { syncEventType: true });

    const normalized = normalizeKoiModelFeel(this, SWIM_MODEL_CPG_DYNAMICS, cfg, {
        locomotionMode,
        activationScore: activityScale,
        activityScale,
        globalActivityScale,
        sleepBlend,
        sleepActivityMultiplier,
        simStepScale,
    });

    this.debugInfo = buildCpgDebugInfo({
        self: this,
        cycleRate,
        netDrive,
        flowGain,
        headingError,
        kappaRef,
        presetState,
        speedScale,
        simStepScale,
        finFlutterSpeed,
        swimSpeedInput,
        swimScale,
        waveAmpScale,
        waveLengthScale,
        stiffnessScale,
        phaseTravel,
        headLateralSway,
        slipDeg: slipLimited.slipDeg,
        turnAuthority,
        normalized,
    });

    if (speedScale <= 0.001) {
        this.velocity.x = 0;
        this.velocity.y = 0;
    }

    this.angle = this.bodyHeading;
    const wake = this.surfaceWake;
    wake.stroke = stroke;
    wake.power = thrustPulse;
    wake.exitPower = 0;
    wake.side = strokeSin;
    wake.powered = speedScale > 0.001 && !(manualControlActive && (!manualHasInput || manualBrake));
    wake.sharp = false;
    return this.getWakeSample(simStepScale);
}
