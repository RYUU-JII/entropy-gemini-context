import {
    applyShoulderPivotInto,
    clamp as clampValue,
    computeCycleRate,
    computeHydroDrag,
    computeTurnBiasedPectoralRates,
    computeCTurnEnvelope,
    suppressBackwardSlip,
} from './koiMotion.js';
import { DEFAULT_KOI_TUNING, PHYSICS_PROPS } from './constants.js';
import { KOI_EVENT_MOTION_LIMITS, resolveKoiEventMotionRange } from './koiEventMotionLimits.js';
import {
    normalizeKoiModelFeel,
    resolveKoiModelTurnCap,
    resolveKoiLocomotionMode,
    syncKoiLocomotionState,
} from './koiModelCalibration.js';
import { resolveKoiMovementBoundsFrame } from './koiSpatialBounds.js';
import { applyEventBodyPose, buildEventDebugInfo } from './koiEventFsmPose.js';


export function updateKoiFishEventFsmRuntime(width, height, frameCount, isHovered, context = {}, helpers = {}) {
    const {
        wrapTurn,
        randomRangeInt,
        beginEvent,
        ensureBehaviorState,
        applyRefractoryDecay,
        computeAIDesiredHeadingEvent,
        chooseAIEvent,
        stepEvent,
        lerp,
        DECISION_INTERVAL_MIN,
        DECISION_INTERVAL_MAX,
        EVENT_NONE,
        EVENT_TURN,
        EVENT_GLIDE,
        EVENT_BURST,
        EVENT_C_TURN,
        applyBodyPose = applyEventBodyPose,
        feelModel = 'event_fsm',
        debugModelName = null,
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
    const manualCTurn = !!control?.cTurn;
    const manualHasInput = manualForward > 0 || manualBoost || manualBrake || Math.abs(manualTurnIntent) > 0;
    const behaviorIntent = context.behaviorIntent?.enabled === true
        ? context.behaviorIntent
        : null;
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
    const frictionLoss = clampValue((1 - this.friction) * (phys.frictionScale ?? 1), 0.0001, 0.3);
    const swimSpeedInput = clampValue(phys.swimSpeedScale ?? 1, 0.5, 8.0);
    const swimScale = Math.pow(swimSpeedInput, 0.84) * 0.64 * timeScale;
    const swimFrequencyGain = clampValue(0.78 + swimSpeedInput * 0.2, 0.72, 2.8);
    const finFlutterSpeed = clampValue(cfg.pectoralFlutterSpeed ?? 1.22, 0.1, 2.0);
    const eventPropulsionGain = clampValue(0.82 + swimSpeedInput * 0.11, 0.75, 1.72);
    const stiffnessScale = clampValue(phys.spineStiffness ?? 1, KOI_EVENT_MOTION_LIMITS.spineStiffness.min, KOI_EVENT_MOTION_LIMITS.spineStiffness.max);
    const waveAmpScale = clampValue(phys.waveAmplitudeScale ?? 1, KOI_EVENT_MOTION_LIMITS.waveAmplitudeScale.min, KOI_EVENT_MOTION_LIMITS.waveAmplitudeScale.max);
    const coreSegment = clampValue(phys.coreSegment ?? 0.34, KOI_EVENT_MOTION_LIMITS.coreSegment.min, KOI_EVENT_MOTION_LIMITS.coreSegment.max);
    const eventHeadYawGain = clampValue(phys.eventHeadYawGain ?? 1, 0.2, 2.8);
    const eventHeadTurnLeadGain = clampValue(phys.eventHeadTurnLeadGain ?? 1, 0.0, 2.8);
    const eventHeadSwayGain = clampValue(phys.eventHeadSwayGain ?? 1, 0.2, 2.8);
    const eventHeadPivotFollow = clampValue(phys.eventHeadPivotFollow ?? 1, 0.2, 2.8);

    const currentSpeed = Math.hypot(this.velocity.x, this.velocity.y);
    const speedNorm = clampValue(currentSpeed / Math.max(1e-6, this.baseSpeed * 3.6), 0, 1);
    const wallSense = this.getWallSense(bounds, this.bodyHeading, this.x, this.y);
    const forwardSpeedRaw = this.velocity.x * Math.cos(this.bodyHeading) + this.velocity.y * Math.sin(this.bodyHeading);
    const forwardSpeed = Math.max(0, forwardSpeedRaw);
    const aiHeadingCadenceRaw = Number(phys.aiHeadingCadence);
    const aiHeadingCadence = Math.max(1, Math.round(Number.isFinite(aiHeadingCadenceRaw) ? aiHeadingCadenceRaw : 2));

    this.turnStrokeCooldown = Math.max(0, this.turnStrokeCooldown - simStepScale);
    this.aiTurnStrokePulse = Math.max(0, this.aiTurnStrokePulse - (manualControlActive ? 0.1 : 0.05) * simStepScale);
    if (this.cTurnCooldown > 0) this.cTurnCooldown -= simStepScale;

    if (manualControlActive) {
        if (manualCTurn && this.cTurnCooldown <= 0 && this.eventState.type !== EVENT_C_TURN) {
            const sign = Math.sign(manualTurnIntent) || (Math.random() < 0.5 ? -1 : 1);
            beginEvent(this, EVENT_C_TURN, { sign, strength: 1.15 });
        }

        if (Math.abs(manualTurnIntent) > 0.001) {
            // A held rudder asks for a course relative to the fish, not an
            // indefinitely accumulated destination angle. That old destination
            // could remain on the wrong side for a second after input reversal.
            this.steerTargetAngle = applyBodyPose === applyEventBodyPose
                ? wrapTurn(this.bodyHeading + manualTurnIntent * (manualBoost ? 1.3 : 1.05))
                : wrapTurn(this.steerTargetAngle + manualTurnIntent * (manualBoost ? 0.11 : 0.085) * simStepScale);
            const currentLead = wrapTurn(this.steerTargetAngle - this.bodyHeading);
            const maxLead = Math.PI * 0.8;
            if (Math.abs(currentLead) > maxLead) {
                this.steerTargetAngle = wrapTurn(this.bodyHeading + Math.sign(currentLead) * maxLead);
            }

            if (this.turnStrokeCooldown <= 0) {
                this.turnStrokeCooldown = manualBoost ? 3 : 6;
                this.aiTurnStrokePulse = Math.max(this.aiTurnStrokePulse, 0.24 + Math.abs(manualTurnIntent) * 0.36);
            }
        } else {
            this.steerTargetAngle = this.lerpAngle(this.steerTargetAngle, this.bodyHeading, 0.2 * simStepScale);
        }
        this.aiHeadingFiltered = this.steerTargetAngle;
        if (this.aiHeadingSampleState) this.aiHeadingSampleState.nextFrame = -Infinity;
    } else {
        this.decisionTimer -= simStepScale;
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
            this.aiHeadingSampleState.cached = computeAIDesiredHeadingEvent(
                this,
                context,
                wallSense,
                simStepScale * aiHeadingCadence,
            );
            this.aiHeadingSampleState.nextFrame = frameCount + aiHeadingCadence;
        }
        const aiHeadingRaw = this.aiHeadingSampleState.cached;
        const aiHeadingFilter = clampValue(
            (0.075 + speedNorm * 0.18 + wallSense.near * 0.14) * simStepScale,
            0.05,
            0.36,
        );
        this.aiHeadingFiltered = this.lerpAngle(this.aiHeadingFiltered, aiHeadingRaw, aiHeadingFilter);
        const aiHeading = this.aiHeadingFiltered;
        const attention = clampValue(behaviorIntent?.steeringAuthority ?? 0, 0, 1);
        const lerpRate = 1 - Math.exp(-(0.008 + wallSense.near * 0.04 + attention * 0.055) * simStepScale);
        this.steerTargetAngle = this.lerpAngle(this.steerTargetAngle, aiHeading, lerpRate);

        if (!context.rosterTransit && this.decisionTimer <= 0 && this.eventState.type === EVENT_NONE && sleepBlend < 0.45) {
            const decisionCadenceScale = clampValue(
                Number(behaviorIntent?.decisionCadenceScale) || 1,
                0.55,
                1.7,
            );
            this.decisionTimer = randomRangeInt(
                this,
                DECISION_INTERVAL_MIN * decisionCadenceScale,
                DECISION_INTERVAL_MAX * decisionCadenceScale,
            );
            const headingNeed = Math.abs(wrapTurn(this.steerTargetAngle - this.bodyHeading));
            const canCTurn = this.cTurnCooldown <= 0 && currentSpeed > 0.012;
            const picked = chooseAIEvent(this, headingNeed, wallSense, canCTurn, speedNorm,
                behaviorIntent, applyBodyPose === applyEventBodyPose);
            if (picked.type !== EVENT_NONE) {
                beginEvent(this, picked.type, {
                    sign: picked.sign,
                    strength: picked.strength,
                });
            }
        }
    }

    const headingErrorRaw = wrapTurn(this.steerTargetAngle - this.bodyHeading);
    const headingDeadzone = manualControlActive ? 0.006 : (wallSense.near > 0.78 ? 0.014 : 0.05);
    const headingError = Math.abs(headingErrorRaw) >= headingDeadzone ? headingErrorRaw : 0;
    const turnNeed = clampValue(Math.abs(headingError) / Math.PI, 0, 1);
    const canRecoverSpin = !manualControlActive && (wallSense.near < 0.74 || wallSense.approachSpeed < 0.004);
    const spinRisk = canRecoverSpin && forwardSpeed < 0.012 && turnNeed > 0.14;
    if (spinRisk) this.spinStallTimer = Math.min(360, (this.spinStallTimer || 0) + simStepScale);
    else this.spinStallTimer = Math.max(0, (this.spinStallTimer || 0) - simStepScale * 1.8);
    const spinStalled = this.spinStallTimer > 30;
    if (spinStalled && canRecoverSpin && sleepBlend < 0.35) {
        this.steerTargetAngle = this.lerpAngle(this.steerTargetAngle, this.bodyHeading, 0.34 * simStepScale);
    }

    if (!manualControlActive && sleepBlend > 0.62 && this.eventState?.type !== EVENT_NONE) {
        this.eventState.type = EVENT_NONE;
        this.eventState.timer = 0;
        this.eventState.duration = 0;
        this.eventState.sign = 0;
        this.eventState.strength = 1;
        this.cTurnPhase = 'none';
    }
    const eventSnapshot = stepEvent(this, simStepScale);
    let activeEvent = eventSnapshot.type;
    let coasting = activeEvent === EVENT_GLIDE
        || (manualControlActive && (!manualHasInput || manualBrake));
    const eventEnv = eventSnapshot.env;
    let cTurnEnv = eventSnapshot.cTurnEnv;

    const rudderTarget = manualControlActive
        ? manualTurnIntent
        : clampValue(headingError * 0.25, -0.5, 0.5);
    this.controlRudder = lerp(
        this.controlRudder,
        rudderTarget,
        clampValue((manualControlActive ? 0.3 : 0.05) * simStepScale, 0.02, 0.5),
    );

    let desiredTurn;
    let turnCap;
    if (manualControlActive) {
        // Keep the analog rudder graded across its whole range. Combining a
        // relative look-ahead angle with the old accumulated-angle gain made
        // every input above ~0.12 saturate the new stroke's muscle request.
        desiredTurn = applyBodyPose === applyEventBodyPose
            ? Math.sign(this.controlRudder) * Math.sqrt(Math.abs(this.controlRudder)) * 0.038
            : this.controlRudder * (0.075 + speedNorm * 0.045) + headingError * (0.2 + (1 - speedNorm) * 0.11);
        turnCap = clampValue((0.052 / Math.sqrt(inertiaScale)) * (1 - speedNorm * 0.3), 0.012, 0.082);
    } else {
        // The trailing-body model steers directly; it has no separate maneuver motor.
        const predictedError = headingError;
        const errAbs = Math.abs(predictedError);
        const deadzone = applyBodyPose === applyEventBodyPose ? 0.05 : 0.22;
        if (errAbs < deadzone && activeEvent === EVENT_NONE) {
            desiredTurn = 0;
            turnCap = 0;
        } else {
            const steerEase = clampValue((errAbs - deadzone) / 0.4, 0, 1);
            const passiveSteerGain = 0.045 * steerEase;
            desiredTurn = predictedError * passiveSteerGain;
            turnCap = 0.028;
        }
    }

    if (activeEvent === EVENT_TURN) {
        const sign = this.eventState.sign || Math.sign(headingError) || 1;
        const flickStrength = sign * eventEnv * this.eventState.strength * 0.115;
        desiredTurn = flickStrength;
        turnCap = 0.25;
        this.aiTurnStrokePulse = Math.max(this.aiTurnStrokePulse, 0.55 + eventEnv * 0.85);
    } else if (activeEvent === EVENT_C_TURN && cTurnEnv) {
        const sign = this.cTurnDirection || this.eventState.sign || Math.sign(headingError) || 1;
        desiredTurn = sign * 0.24 * cTurnEnv.turnGain + headingError * 0.04;
        turnCap = clampValue(0.4 * cTurnEnv.turnGain, 0.08, 0.45);
        this.aiTurnStrokePulse = Math.max(this.aiTurnStrokePulse, 0.5 + cTurnEnv.waveGain * 0.6);
    }

    if (!manualControlActive && (activeEvent === EVENT_NONE || activeEvent === EVENT_GLIDE)) {
        // A swimming turn needs distance through water. A fixed yaw cap lets a
        // slowing fish rotate inside its own body length, especially on a glide.
        const bodyLength = this.segmentSpacing * (this.history.length - 1);
        const turnRadius = Math.min(
            bodyLength * (coasting ? 1.8 : 1.35),
            Math.min(bounds.width, bounds.height) * (coasting ? 0.28 : 0.22),
        );
        const travelTurn = currentSpeed * simStepScale / turnRadius;
        const wallTurn = Math.pow(wallSense.near, 2) * 0.028;
        turnCap = Math.min(turnCap, travelTurn + wallTurn);
    }
    turnCap = Math.min(turnCap, resolveKoiModelTurnCap(feelModel, activeEvent));
    this.turnRate = lerp(this.turnRate * 0.85, desiredTurn, clampValue(0.2 * simStepScale, 0.06, 0.55));
    const actualTurn = clampValue(this.turnRate, -turnCap, turnCap);
    const baseCruiseThrottle = PHYSICS_PROPS.baseCruiseThrottle;
    let throttleTarget;
    if (manualControlActive) {
        if (manualBrake) throttleTarget = 0;
        else if (manualBoost) throttleTarget = PHYSICS_PROPS.burstThrottle;
        else throttleTarget = manualForward > 0 ? clampValue(0.36 + manualForward * 0.46, 0.34, 0.86) : 0;
    } else {
        const cruiseSpeedComp = clampValue(0.45 - speedNorm, -0.2, 0.3);
        throttleTarget = clampValue(baseCruiseThrottle + cruiseSpeedComp * 0.3, 0.65, 0.85);
        throttleTarget *= 1 - sleepBlend * 0.84;
    }
    if (!manualControlActive && behaviorIntent) {
        throttleTarget += clampValue(Number(behaviorIntent.throttleBias) || 0, -0.22, 0.18);
    }

    if (activeEvent === EVENT_GLIDE) {
        throttleTarget = 0;
    } else if (activeEvent === EVENT_BURST) {
        throttleTarget += 0.22 + eventEnv * 0.34 * this.eventState.strength;
    } else if (activeEvent === EVENT_C_TURN && cTurnEnv) {
        if (cTurnEnv.phase === 'prepare') throttleTarget *= 0.18;
        else if (cTurnEnv.phase === 'snap') throttleTarget += 0.36 + cTurnEnv.snapPower * 0.38;
        else throttleTarget *= 0.48;
    }
    throttleTarget = clampValue(throttleTarget, 0, 1.08);

    const throttleRise = PHYSICS_PROPS.throttleRise ?? 0.24;
    const throttleFall = PHYSICS_PROPS.throttleFall ?? 0.12;
    const throttleFollow = throttleTarget > this.manualThrottle ? throttleRise : throttleFall;
    this.manualThrottle = this.lerp(this.manualThrottle, throttleTarget, 1 - Math.pow(1 - throttleFollow, simStepScale));

    let brakeTarget = manualBrake ? 1 : 0;
    if (!manualControlActive && activeEvent === EVENT_C_TURN && cTurnEnv?.phase === 'prepare') brakeTarget = 0.18;
    this.brake = this.lerp(this.brake, brakeTarget, brakeTarget > this.brake ? 0.22 : 0.1);

    let cycleState = 'cruise';
    if (activeEvent === EVENT_GLIDE) cycleState = 'glide';
    else if (activeEvent === EVENT_TURN || activeEvent === EVENT_C_TURN) cycleState = 'drift';
    let cycleRate = computeCycleRate(cycleState, speedNorm, turnNeed) * swimScale;
    cycleRate = Math.max(cycleRate, 0.006 * swimScale);
    cycleRate *= 0.2 + sleepTailScale * 0.8;
    if (activeEvent === EVENT_BURST) cycleRate *= 1.18;
    if (activeEvent === EVENT_C_TURN && cTurnEnv) cycleRate *= 1 + cTurnEnv.waveGain * 0.32;

    let idleTarget = 0.08;
    let waveTarget = 0.55;
    if (activeEvent === EVENT_GLIDE) {
        idleTarget = manualControlActive ? 0.95 : 0.7;
        waveTarget = manualControlActive ? 0.03 : 0.1;
    } else if (activeEvent === EVENT_TURN) {
        idleTarget = 0.08;
        waveTarget = 0.58;
    } else if (activeEvent === EVENT_BURST) {
        idleTarget = 0.04;
        waveTarget = 0.74;
    } else if (activeEvent === EVENT_C_TURN && cTurnEnv) {
        idleTarget = cTurnEnv.phase === 'recover' ? 0.38 : 0.04;
        waveTarget = 0.82;
    }
    if (coasting) {
        idleTarget = 0.96;
        waveTarget = 0.02;
    }
    idleTarget = clampValue(idleTarget + sleepBlend * 0.58, 0.08, 0.985);
    waveTarget = clampValue(waveTarget * (1 - sleepBlend * 0.94), 0.02, 0.9);
    this.tailIdleBlend = this.lerp(this.tailIdleBlend, idleTarget, idleTarget > this.tailIdleBlend ? 0.12 : 0.09);
    this.tailWaveBlend = this.lerp(this.tailWaveBlend, waveTarget, waveTarget > this.tailWaveBlend ? 0.11 : 0.08);

    const tailMotionGate = 1 - this.tailIdleBlend * 0.88;
    // One oscillator drives the travelling wave, recoil and both half-strokes.
    // Tail-tip speed is highest at mid-sweep; squared cosine supplies two kicks.
    this.shapePhase += (
        this.wiggleSpeed * (0.06 + tailMotionGate * 0.56) * timeScale
        + cycleRate * 0.52
        + currentSpeed * 0.007 * timeScale
    ) * speedScale * swimFrequencyGain * hoverRhythmScale * simStepRateScale;
    this.swimCycle = this.shapePhase;
    this.propulsionPhase = this.shapePhase;
    this.tailPhase = this.shapePhase;
    const headingBefore = this.bodyHeading;
    this.bodyHeading = wrapTurn(this.bodyHeading + actualTurn);
    this.turnRate = actualTurn;

    const pivotOffset = this.segmentSpacing * (this.neckIndex + 0.9) * 0.15;
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
    const pivotFollow = clampValue((0.12 + turnNeed * 0.24) * simStepScale * eventHeadPivotFollow, 0.04, 0.65);
    this.x = lerp(this.x, pivotedHead.x, pivotFollow);
    this.y = lerp(this.y, pivotedHead.y, pivotFollow);
    const shoulderBound = this.segmentSpacing * 0.45;
    const shoulderOffsetX = clampValue(pivotedHead.x - this.x, -shoulderBound, shoulderBound);
    const shoulderOffsetY = clampValue(pivotedHead.y - this.y, -shoulderBound, shoulderBound);

    const propulsionDelta = wrapTurn(this.bodyHeading - this.propulsionDir);
    const propulsionFollow = coasting ? 0.11 : (manualControlActive ? 0.31 : 0.22);
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
    this.finPhaseL += finRates.rateL * speedScale * finFlutterSpeed * hoverRhythmScale * simStepRateScale;
    this.finPhaseR += finRates.rateR * speedScale * finFlutterSpeed * hoverRhythmScale * simStepRateScale;

    const coreIndex = Math.max(1, Math.min(this.history.length - 2, Math.round((this.history.length - 1) * coreSegment)));
    const coreT = coreIndex / Math.max(1, this.history.length - 1);
    const wavelengthRange = resolveKoiEventMotionRange(feelModel, 'wavelengthScale');
    const phaseTravel = 4.0 / Math.sqrt(clampValue(phys.wavelengthScale ?? 1,
        wavelengthRange.min, wavelengthRange.max));
    const tailTipPhase = this.shapePhase - (1 - coreT) * phaseTravel;
    const tailSweepSpeed = Math.cos(tailTipPhase);
    const stroke = tailSweepSpeed * tailSweepSpeed;
    const thrustPulse = coasting ? 0 : stroke * (1 - this.tailIdleBlend * 0.66);
    const headYaw = -Math.sin(this.shapePhase) * this.tailWaveBlend * 0.009 * eventHeadYawGain;

    const throttleForce = phys.throttleForce ?? PHYSICS_PROPS.throttleForce;
    const driveBase = accel * throttleForce * 0.88 * (0.86 + (1 - speedNorm) * 0.14) * eventPropulsionGain;
    const throttleDrive = accel * throttleForce * this.manualThrottle;
    let drive = manualControlActive ? throttleDrive : driveBase * this.manualThrottle;
    const thrustBoost = activeEvent === EVENT_TURN ? 2.2 : 1.0;
    let thrust = accel * (0.18 + this.manualThrottle * 0.32) * thrustPulse * thrustBoost * eventPropulsionGain;
    thrust += accel * (this.aiTurnStrokePulse || 0) * 0.2;

    if (activeEvent === EVENT_BURST) {
        thrust += accel * (0.24 + eventEnv * 0.34) * this.eventState.strength;
    } else if (activeEvent === EVENT_TURN) {
        thrust += accel * eventEnv * 0.12 * this.eventState.strength;
    } else if (activeEvent === EVENT_C_TURN && cTurnEnv) {
        thrust += accel * (0.16 + cTurnEnv.thrustGain * 0.32) * (0.3 + cTurnEnv.snapPower * 0.7);
        if (cTurnEnv.phase === 'prepare') drive *= 0.46;
        if (cTurnEnv.phase === 'recover') drive *= 0.62;
    }

    if (coasting) {
        drive = 0;
        thrust = 0;
    }
    if (!manualControlActive && sleepBlend > 0.001) {
        drive *= sleepDriveScale;
        thrust *= sleepDriveScale * 0.88;
    }

    const flow = this.getFlowVector(width, height, frameCount);
    const flowGain = (manualControlActive ? 0 : 0.014) * simStepScale;
    // Modulate the mean drive rather than adding a free-running propulsion clock.
    const netDrive = (drive + thrust) * (0.78 + stroke * 0.44);
    const wobbledDir = this.propulsionDir + headYaw * (0.28 + speedNorm * 0.16);
    this.velocity.x += Math.cos(wobbledDir) * netDrive + flow.x * flowGain;
    this.velocity.y += Math.sin(wobbledDir) * netDrive + flow.y * flowGain;
    if (!manualControlActive && sleepDrift && sleepBlend > 0.02) {
        this.velocity.x += sleepDrift.x;
        this.velocity.y += sleepDrift.y;
    }

    if (spinStalled && canRecoverSpin && sleepBlend < 0.35) {
        const recoveryKick = accel * (0.012 + this.manualThrottle * 0.03) * Math.max(0.6, simStepScale);
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

    const wallPush = Math.pow(wallSense.near, 1.6) * (0.0014 + wallSense.approachSpeed * 0.12);
    if (wallPush > 0) {
        this.velocity.x += wallSense.normal.x * wallPush;
        this.velocity.y += wallSense.normal.y * wallPush;
    }

    let forwardDamping = coasting ? 0.999 : 0.992;
    if (activeEvent === EVENT_BURST) forwardDamping = 0.989;
    if (activeEvent === EVENT_TURN) forwardDamping = 0.991;
    if (activeEvent === EVENT_C_TURN) forwardDamping = 0.987;

    let lateralDamping = coasting ? 0.96 : 0.75;
    if (activeEvent === EVENT_TURN) lateralDamping = 0.7;
    if (activeEvent === EVENT_BURST) lateralDamping = 0.68;
    if (activeEvent === EVENT_C_TURN && cTurnEnv) {
        forwardDamping = clampValue(forwardDamping * cTurnEnv.dragGain, 0.95, 0.999);
        lateralDamping = clampValue(lateralDamping * (0.9 - cTurnEnv.snapPower * 0.2), 0.56, 0.84);
    }
    // Scale drag loss, not retained velocity: multiplying retention by 1.05
    // formerly exceeded one and hit the 0.999 ceiling, making every coast icy.
    const frictionRetention = 1 - frictionLoss * (coasting ? 0.075 : 1) / Math.sqrt(inertiaScale);
    forwardDamping = Math.pow(clampValue(frictionRetention * forwardDamping, 0.94, 0.999), simStepScale);
    lateralDamping = Math.pow(clampValue(lateralDamping, 0.56, 0.98), simStepScale);

    const drag = computeHydroDrag({
        velocity: this.velocity,
        moveAngle: this.propulsionDir,
        forwardDamping,
        lateralDamping,
    });

    const minForward = coasting ? 0 : manualControlActive ? (manualHasInput ? 0.0004 : 0) : 0.0007;
    const minDrive = coasting ? 0 : manualControlActive ? (manualHasInput ? accel * 0.001 : 0) : accel * 0.0012;
    const slip = suppressBackwardSlip({
        velocity: { x: drag.x, y: drag.y },
        heading: this.bodyHeading,
        minForward: minForward * simStepScale,
        recoverRate: 0.78 * simStepScale,
        maxRecover: 0.045 * simStepScale,
        minDrive: minDrive * simStepScale,
    });
    this.velocity.x = slip.x;
    this.velocity.y = slip.y;

    const locomotionMode = resolveKoiLocomotionMode(
        (!manualControlActive && sleepBlend > 0.68)
            ? 'sleep'
            : (coasting ? 'glide' : activeEvent === EVENT_NONE ? 'cruise' : activeEvent),
        'cruise',
    );
    syncKoiLocomotionState(this, locomotionMode, {
        syncEventType: false,
        cTurnPhase: activeEvent === EVENT_C_TURN && cTurnEnv ? cTurnEnv.phase : 'none',
    });

    const normalized = normalizeKoiModelFeel(this, feelModel, cfg, {
        locomotionMode,
        activationScore: activityScale,
        activityScale,
        globalActivityScale,
        sleepBlend,
        sleepActivityMultiplier,
        simStepScale,
        turnStepScale: 1,
    });

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


    const pose = applyBodyPose(this, {
        coreSegment,
        phys,
        eventHeadSwayGain,
        eventHeadTurnLeadGain,
        turnNeed,
        waveAmpScale,
        shoulderOffsetX,
        shoulderOffsetY,
        inertiaScale,
        speedNorm,
        stroke,
        wrapTurn,
        stiffnessScale,
        activeEvent,
        eventEnv,
        cTurnEnv,
        EVENT_GLIDE,
        EVENT_TURN,
        EVENT_C_TURN,
        headYaw,
    });
    const h = pose.history;
    const headLateralSway = pose.headLateralSway;

    this.hoverScale = isHovered ? Math.min(1.15, this.hoverScale + 0.02) : Math.max(1, this.hoverScale - 0.02);
    this.labelOpacity = isHovered ? Math.min(1, this.labelOpacity + 0.1) : Math.max(0, this.labelOpacity - 0.05);
    this.tailPos = h[h.length - 1];
    this.lastSpeed = Math.hypot(this.velocity.x, this.velocity.y);

    this.debugInfo = buildEventDebugInfo({
        self: this,
        cTurnEnv,
        cycleRate,
        netDrive,
        flowGain,
        headingError,
        canRecoverSpin,
        forwardSpeed,
        headLateralSway,
        eventHeadYawGain,
        eventHeadTurnLeadGain,
        eventHeadSwayGain,
        eventHeadPivotFollow,
        finFlutterSpeed,
        swimFrequencyGain,
        eventPropulsionGain,
        behaviorIntent,
        normalized,
        debugModelName,
    });

    if (speedScale <= 0.001) {
        this.velocity.x = 0;
        this.velocity.y = 0;
    }

    this.angle = this.bodyHeading;
    const wake = this.surfaceWake;
    if (wake) {
        wake.stroke = stroke;
        wake.power = thrustPulse;
        wake.exitPower = cTurnEnv ? cTurnEnv.snapPower : 0;
        wake.side = tailSweepSpeed;
        wake.powered = !coasting && speedScale > 0.001;
        wake.sharp = activeEvent === EVENT_C_TURN;
    }
    return this.getWakeSample(simStepScale);
}
