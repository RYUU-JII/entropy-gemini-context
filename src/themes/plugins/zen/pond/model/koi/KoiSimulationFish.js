import { createZenKoiSurfaceWake } from './zenKoiSurfaceWake.js';
import { createZenKoiPersonality } from './zenKoiPersonality.js';
import { DEFAULT_KOI_TUNING, PHYSICS_PROPS } from './constants.js';
import { parseHexColorSafe } from './appearance/colorMath.js';
import { updateKoiFish } from './koiDynamics.js';
import { koiFishAppearanceMethods } from './koiFishAppearanceMethods.js';
import { koiFishGeometryMethods } from './koiFishGeometryMethods.js';
import { koiFishBehaviorMethods } from './koiFishBehaviorMethods.js';
import {
    buildKoiSpawnHistory,
    sampleKoiSpawnPoseInsideBounds,
} from './koiSpatialBounds.js';

let KOI_UID_SEQUENCE = 1;
const ACTIVE_PRESENCE_INITIAL_OPACITY = 0.32;

class KoiSimulationFish {
constructor(width, height, domain, risk = 0, status = 'blocked', tuning = DEFAULT_KOI_TUNING, spawnBounds = null) {
        this.tuning = tuning;
        this.uid = KOI_UID_SEQUENCE++;
        const spawnPose = sampleKoiSpawnPoseInsideBounds({
            width: Number(spawnBounds?.width) > 0 ? spawnBounds.width : width,
            height: Number(spawnBounds?.height) > 0 ? spawnBounds.height : height,
            originX: Number(spawnBounds?.x) || 0,
            originY: Number(spawnBounds?.y) || 0,
            tuning,
        });
        Object.assign(this, { width, height, domain, risk, status, x: spawnPose.x, y: spawnPose.y });
        this.entityId = typeof domain === 'string' && domain.trim() ? domain.trim() : null;
        this.slot = 'resident';
        this.presenceState = 'active';
        this.priority = 0;
        this.opacity = ACTIVE_PRESENCE_INITIAL_OPACITY;
        this.targetOpacity = 1;
        this.angle = spawnPose.angle;

        // Preserve the existing locomotor variation and its random sequence.
        // Social/interaction temperament is identity-stable and does not retune
        // the acceleration, cruise speed or stroke parameters below.
        this.personality = {
            curiosity: 0.1 + Math.random() * 0.9,
            energy: 0.3 + Math.random() * 0.7,
            laziness: Math.random(),
        };
        this.behaviorTemperament = createZenKoiPersonality(this.entityId === null ? `ephemeral-${this.uid}` : this.entityId);

        this.speedMultiplier = 0.8 + Math.random() * 0.5;
        this.baseSpeed = 0.082 + this.personality.energy * 0.09;
        this.speed = this.baseSpeed;
        this.targetAngle = this.angle;
        this.targetAngleVariation = 0.04 + this.personality.curiosity * 0.08;
        this.geometryDirty = true;

        this.velocity = { x: 0, y: 0 };
        this.sleepBlend = 0;
        this.acceleration = 0.0125 + this.personality.energy * 0.0115;
        this.friction = 0.964 + Math.random() * 0.012;
        this.wiggleAmount = 0.15 + Math.random() * 0.1;
        this.wiggleSpeed = 0.008 + this.personality.energy * 0.012;

        this.historyLength = tuning.historyLength || 20;
        this.syncGeometryDimensions(tuning);

        this.history = buildKoiSpawnHistory({
            x: this.x,
            y: this.y,
            angle: this.angle,
            historyLength: this.historyLength,
            segmentSpacing: this.segmentSpacing,
        });
        this.neckIndex = Math.max(1, Math.min(5, this.historyLength) - 1);

        this.swimCycle = Math.random() * Math.PI * 2;

        this.styleInitialized = false;
        this.appearanceProfile = null;
        this.expressionProfile = null;
        this.hoverScale = 1;
        this.labelOpacity = 0;
        this.depth = Math.random() * 0.5;
        this.baseSize = 0;
        this.targetRisk = risk;
        this.invalidateGeometryDimensions();
        this.syncGeometryDimensions();

        this.tailPhase = Math.random() * Math.PI * 2;
        this.propulsionPhase = Math.random() * Math.PI * 2;
        this.shapePhase = Math.random() * Math.PI * 2;
        this.flowSeed = Math.random() * Math.PI * 2;
        this.bodyHeading = this.angle;
        this.propulsionDir = this.angle;
        this.tailIdleBlend = 1;
        this.finPhaseL = Math.random() * Math.PI * 2;
        this.finPhaseR = Math.random() * Math.PI * 2;
        this.cTurnPhase = 'none';
        this.surfaceWake = createZenKoiSurfaceWake();
        this.lastSpeed = 0;
        this.driftBias = { x: 0, y: 0 };

        this.throttle = PHYSICS_PROPS.baseCruiseThrottle;
        this.brake = 0;
        this.actionState = 'cruise';
        this.isCTurning = false;
        this.cTurnCooldown = this.randomInt(PHYSICS_PROPS.cTurnCooldownMin, PHYSICS_PROPS.cTurnCooldownMax);

        this.cTurnTimer = 0;
        this.cTurnDuration = 0;
        this.cTurnDirection = 0;
        this.roamAnchor = { x: this.x, y: this.y };
        this.roamTimer = 0;
        this.tailWaveMemory = Array.from({ length: this.historyLength }, () => 0);
        this.segmentWave = Array.from({ length: this.historyLength }, () => 0);
        this.tailWaveBlend = 0;
        this.eventBodyFrame = null;
        this.sessionSalt = null;
        this.tuning = tuning || DEFAULT_KOI_TUNING;
        this.sessionJitter = {
            flowGain: 1,
            randomPhase: Math.random() * Math.PI * 2,
            secondaryPhase: Math.random() * Math.PI * 2,
            wakePhase: Math.random() * Math.PI * 2,
            roamSpan: 0.34,
        };
        this.slotMotionBaseline = {
            speedMultiplier: this.speedMultiplier,
            baseSpeed: this.baseSpeed,
            targetAngleVariation: this.targetAngleVariation,
            acceleration: this.acceleration,
            wiggleAmount: this.wiggleAmount,
            wiggleSpeed: this.wiggleSpeed,
        };
        this.sessionJitterBase = {
            flowGain: this.sessionJitter.flowGain,
            roamSpan: this.sessionJitter.roamSpan,
        };
        this.turnRate = 0;
        this.controlRudder = 0;
        this.manualThrottle = PHYSICS_PROPS.baseCruiseThrottle;
        this.aiHeadingFiltered = this.angle;
        this.turnStrokeCooldown = 0;
        this.turnAccumulator = 0;
        this.turnRefractory = 0;
        this.turnCommitTimer = 0;
        this.turnCommitStrength = 0;
        this.turnCommitSign = 0;
        this.turnEnergy = 0;
        this.desiredTurnFiltered = 0;
        this.aiTurnStrokePulse = 0;
        this.aiTurnImpulseRemaining = 0;
        this.aiDecisionTimer = this.randomInt(5, 11);
        this.prevKickPhase = 0;
        this.banking = 0;
        this.updateColor();
        this.applySlotMotionProfile();
    }

hashString(v) {
        let h = 2166136261;
        for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v.charCodeAt(i), 16777619);
        return h >>> 0;
    }

makeRng(seed) {
        let s = seed >>> 0;
        return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    }

lerpAngle(a, b, t) {
        let d = b - a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return a + d * t;
    }

lerp(a, b, t) {
        return a + (b - a) * t;
    }

randomInt(min, max) {
        const lo = Math.floor(Math.min(min, max));
        const hi = Math.floor(Math.max(min, max));
        return lo + Math.floor(Math.random() * (hi - lo + 1));
    }

mixColor(a, b, t) {
        const ca = parseHexColorSafe(a, '#000000');
        const cb = parseHexColorSafe(b, '#000000');
        const f = (v1, v2) => Math.max(0, Math.min(255, Math.round(v1 + (v2 - v1) * t)));
        const r = f(ca.r, cb.r);
        const g = f(ca.g, cb.g);
        const bc = f(ca.b, cb.b);
        return `#${((1 << 24) + (r << 16) + (g << 8) + bc).toString(16).slice(1)}`;
    }

    // Visual fork of the current native v1 pose/rig. No constructor, roster ID,
    // global random draw, model copy, or alternate dynamics implementation.
    forkSentinelPresentationRig() {
        if (!(this instanceof KoiSimulationFish) || this.domain !== 'nudge_shadow' || this.status !== 'blocked'
            || this.tuning?.physics?.swimModel !== 'event_fsm_life_v1'
            || !Number.isSafeInteger(this.uid) || this.uid <= 0
            || this.uid + 0.5 === this.uid || this.styleInitialized !== true
            || this.appendagePose != null
            || !Array.isArray(this.history) || this.history.length < 2 || this.history.length > 256) {
            throw new Error('KOI_SENTINEL_PRESENTATION_FORK_SOURCE_INVALID');
        }
        const fork = Object.create(Object.getPrototypeOf(this));
        const copyFields = (source, target, fields) => {
            for (const key of fields) if (Object.hasOwn(source, key)) target[key] = source[key];
        };
        copyFields(this, fork, [
            'width', 'height', 'domain', 'risk', 'status', 'entityId', 'slot', 'presenceState',
            'priority', 'opacity', 'targetOpacity', 'x', 'y', 'angle', 'bodyHeading', 'propulsionDir',
            'speedMultiplier', 'baseSpeed', 'speed', 'targetAngle', 'targetAngleVariation',
            'geometryDirty', 'sleepBlend', 'acceleration', 'friction', 'wiggleAmount', 'wiggleSpeed',
            'historyLength', 'baseSize', 'segmentSpacing', 'neckIndex', 'swimCycle',
            'styleInitialized', 'hoverScale', 'labelOpacity', 'depth', 'targetRisk',
            'tailPhase', 'propulsionPhase', 'shapePhase', 'flowSeed', 'tailIdleBlend', 'finPhaseL', 'finPhaseR',
            'cTurnPhase', 'lastSpeed', 'throttle', 'brake', 'actionState', 'isCTurning',
            'cTurnCooldown', 'cTurnTimer', 'cTurnDuration', 'cTurnDirection', 'roamTimer',
            'tailWaveBlend', 'sessionSalt', 'turnRate', 'controlRudder', 'manualThrottle',
            'aiHeadingFiltered', 'steerTargetAngle', 'turnStrokeCooldown', 'turnAccumulator',
            'turnRefractory', 'turnCommitTimer', 'turnCommitStrength', 'turnCommitSign', 'turnEnergy',
            'desiredTurnFiltered', 'aiTurnStrokePulse', 'aiTurnImpulseRemaining', 'aiDecisionTimer',
            'prevKickPhase', 'banking', 'hoverMotionBlend', 'manualControlActive', 'spinStallTimer', 'decisionTimer',
            'variant', 'styleStatus', 'dynamicFaviconColors', 'scaleType', 'doitsuMode', 'isGinrin',
            'ginrinDensity', 'colorBody', 'colorPattern', 'colorSecondary', 'colorAccent', 'colorFin',
            'colorTail', 'eyeColor', 'finStyle', 'patternStyle', 'patternSignature', 'patternCandidateCount',
            'patternIntensity', 'aggression', 'shadowOutlineColor', 'shadowOutlineWidthScale',
        ]);
        // Resolved model/style records are read-only inputs. Mutable motor memory
        // and render caches below belong to this one presentation role.
        copyFields(this, fork, [
            'tuning', 'appearanceProfile', 'expressionProfile', 'palette', 'appearanceResolverMeta',
            'patternMarks', 'patternBlueprintMeta', 'slotMotionBaseline', 'slotMotionProfile', 'sessionJitterBase',
        ]);
        const record = (source, fields) => {
            if (source == null) return source;
            const target = {};
            copyFields(source, target, fields);
            return target;
        };
        fork.personality = record(this.personality, ['curiosity', 'energy', 'laziness']);
        fork.behaviorTemperament = record(this.behaviorTemperament, ['curiosity', 'energy', 'laziness', 'boldness', 'sociality']);
        fork.velocity = record(this.velocity, ['x', 'y']);
        fork.driftBias = record(this.driftBias, ['x', 'y']);
        fork.roamAnchor = record(this.roamAnchor, ['x', 'y']);
        fork.sessionJitter = record(this.sessionJitter, ['flowGain', 'randomPhase', 'secondaryPhase', 'wakePhase', 'roamSpan']);
        fork.surfaceWake = record(this.surfaceWake, ['stroke', 'power', 'exitPower', 'side', 'powered', 'sharp', 'strokeArmed', 'exitArmed', 'cooldown']);
        fork.eventState = record(this.eventState, ['type', 'timer', 'duration', 'sign', 'strength']);
        fork.eventRefractory = record(this.eventRefractory, ['turn', 'glide', 'burst', 'c_turn']);
        fork.aiHeadingSampleState = record(this.aiHeadingSampleState, ['nextFrame', 'cached']);
        fork.flowVector = record(this.flowVector, ['x', 'y', 'angle']);
        fork.flowSampleState = record(this.flowSampleState, ['nextFrame', 'phaseOffset', 'sampledX', 'sampledY', 'sampledAngle']);
        if (fork.flowSampleState) fork.flowSampleState.sampleScratch = record(this.flowSampleState.sampleScratch, ['x', 'y', 'angle']);
        fork.shadowRenderProfile = record(this.shadowRenderProfile, ['enabled', 'cadence', 'blur', 'opacity', 'scale']);
        fork.history = this.history.map(point => {
            if (![point.x, point.y, point.angle].every(Number.isFinite)) throw new Error('KOI_SENTINEL_PRESENTATION_FORK_RIG_INVALID');
            return { x: point.x, y: point.y, angle: point.angle };
        });
        for (const key of ['tailWaveMemory', 'segmentWave']) {
            if (!Array.isArray(this[key]) || this[key].length > 256 || !this[key].every(Number.isFinite)) {
                throw new Error('KOI_SENTINEL_PRESENTATION_FORK_RIG_INVALID');
            }
            fork[key] = this[key].slice();
        }
        const tailIndex = this.history.indexOf(this.tailPos);
        fork.tailPos = tailIndex >= 0 ? fork.history[tailIndex] : record(this.tailPos, ['x', 'y', 'angle']);
        fork.eventBodyFrame = record(this.eventBodyFrame, ['displayedBend']);
        if (fork.eventBodyFrame) {
            if (this.eventBodyFrame.centerline !== this.history) throw new Error('KOI_SENTINEL_PRESENTATION_FORK_FRAME_INVALID');
            fork.eventBodyFrame.centerline = fork.history;
            fork.eventBodyFrame.maneuver = record(this.eventBodyFrame.maneuver, ['active', 'kind', 'progress', 'serial', 'pendingTurn', 'sweepBias', 'glideKick']);
        }
        fork.appendagePose = null;
        fork._patternMarksSortedSource = null;
        fork._patternMarksSorted = null;
        fork.shoulderPivotScratch = null;
        fork.debugInfo = null;
        // Native cadence uses a positive numeric uid, without integer-only
        // indexing. Half-integers occupy a visual-only namespace and never
        // advance KOI_UID_SEQUENCE or enter a roster/neighbor lookup.
        fork.uid = this.uid + 0.5;
        fork.sentinelPresentationSamplingId = fork.uid;
        fork.sentinelPresentationRandomState = (this.hashString('sentinel-ally-' + this.uid) ^ this.appearanceProfile.seed) >>> 0;
        fork.randomInt = function (min, max) {
            this.sentinelPresentationRandomState = (Math.imul(this.sentinelPresentationRandomState, 1664525) + 1013904223) >>> 0;
            const lo = Math.floor(Math.min(min, max)), hi = Math.floor(Math.max(min, max));
            return lo + Math.floor((this.sentinelPresentationRandomState / 4294967296) * (hi - lo + 1));
        };
        fork.styleRng = fork.makeRng(this.appearanceProfile.seed);
        return fork;
    }

    getSize(targetRisk) {
        return Number(this.tuning?.baseSize) > 0 ? Number(this.tuning.baseSize) : 15;
    }

update(width, height, frameCount, isHovered, targetRisk, context = {}) {
        this.tuning = context.tuning || this.tuning || DEFAULT_KOI_TUNING;
        this.syncGeometryDimensions();
        return updateKoiFish.call(this, width, height, frameCount, isHovered, targetRisk, context);
    }
}

Object.assign(
    KoiSimulationFish.prototype,
    koiFishAppearanceMethods,
    koiFishGeometryMethods,
    koiFishBehaviorMethods,
);

export { KoiSimulationFish };
