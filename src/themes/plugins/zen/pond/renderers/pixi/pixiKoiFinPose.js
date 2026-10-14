import {
    clamp as clampValue,
    computePectoralStrokeWave,
    computeTailJointPose,
    normalizeCyclePhase,
    resolveTailSpriteRotationFromJointTip,
} from '../../model/koi/koiMotion.js';

export const resolveZenKoiTailSpriteRotation = ({
    history, swimModel, turnRate, bank, tailTurnSpreadGain = 0.45,
}) => {
    const articulatedEventSpine = swimModel === 'event_fsm_life_v1' || swimModel === 'event_fsm';
    if (!articulatedEventSpine) {
        const pose = computeTailJointPose({
            history,
            turnRate,
            bank,
            tailTurnSpreadGain,
        });
        return resolveTailSpriteRotationFromJointTip(pose.jointTipAngle);
    }
    const pose = computeTailJointPose({
        history,
        turnRate: 0,
        bank: 0,
        tailTurnSpreadGain,
    });
    // Elastic caudal fin: follow distal vertebra with organic web flex and bounded hydrodynamic deflection
    const webFlex = 0.26 * Math.tanh(pose.chainBend * 0.45 / 0.26);
    const turnFlex = clampValue(-(turnRate || 0) * 0.42 + (bank || 0) * 0.12, -0.16, 0.16);
    return resolveTailSpriteRotationFromJointTip(pose.tipBackAngle + webFlex + turnFlex);
};

export const applyKoiFinTransform = (sprite, spinePos, radius, isMain, sideIndex, bend, idx, context) => {
    const cfg = context.cfg || {};
    const fishInfo = context.fishInfo || {};
    sprite.position.set(spinePos.x, spinePos.y);
    const localScale = isMain ? 1 : 0.75;
    const appendagePose = context.appendagePose || {};
    const pectoralBrake = isMain ? clampValue(Math.max(
        Number(appendagePose.pectoralBrake) || 0, Number(fishInfo.brake) || 0,
    ), 0, 1) : 0;
    const pectoralDrive = isMain ? clampValue(Number(appendagePose.pectoralDrive) || 0, 0, 1) : 0;
    const finLengthScale = 1 + pectoralBrake * 0.08 + pectoralDrive * 0.03;
    const finSideScale = 1 + pectoralBrake * 0.14 - pectoralDrive * 0.04;

    const perpAngle = spinePos.angle + (Math.PI / 2) * sideIndex;
    const sideOffset = isMain ? (cfg.pectoralPosSide ?? 1.0) : (cfg.ventralPosSide ?? 1.0);
    sprite.x += Math.cos(perpAngle) * radius * sideOffset;
    sprite.y += Math.sin(perpAngle) * radius * sideOffset;

    const flutterAmp = isMain ? (cfg.pectoralFlutterAmp ?? 0.34) : 0.02;
    const finPhase = sideIndex === 1 ? fishInfo.finPhaseR : fishInfo.finPhaseL;
    const phased = finPhase - idx * 0.15;
    const phaseNorm = normalizeCyclePhase(phased);
    const strokeWave = computePectoralStrokeWave(phased, {
        preloadPhase: cfg.pectoralStrokePreloadPhase,
        powerEndPhase: cfg.pectoralStrokePowerEndPhase,
        recoveryEndPhase: cfg.pectoralStrokeRecoveryEndPhase,
        overshootPhase: cfg.pectoralStrokeOvershootPhase,
        preloadDepth: cfg.pectoralStrokePreloadDepth,
        overshootAmplitude: cfg.pectoralStrokeOvershootAmp,
    });
    const isDriveFin = context.driveSide !== 0 && sideIndex === context.driveSide;
    const isOpposingFin = context.driveSide !== 0 && sideIndex !== context.driveSide;
    let strokeScale = 1;
    if (isDriveFin) strokeScale += context.turnBlend * context.driveAmpBoost;
    if (isOpposingFin) strokeScale *= 1 - context.turnBlend * (1 - context.opposingAmpMin);

    const idleBlend = clampValue(Number(fishInfo.tailIdleBlend) || 0, 0, 1);
    const stationKeeping = 1 - idleBlend * 0.68 * (1 - context.turnBlend);
    let finWave = strokeWave * flutterAmp * strokeScale * stationKeeping;
    if (isOpposingFin && context.turnBlend > 0.001) {
        const recoveryGate = clampValue(
            (phaseNorm - context.strokeRecoveryStart) / Math.max(1e-6, context.strokeRecoveryEnd - context.strokeRecoveryStart),
            0,
            1,
        );
        finWave *= 1 - recoveryGate * context.opposingRecoveryFeather * context.turnBlend;
    }

    let foldOffset = 0;
    if (isDriveFin) foldOffset += context.turnBlend * context.driveSweep;
    if (isOpposingFin) foldOffset -= context.turnBlend * context.opposingFold;

    // Pitch the web edge-on during recovery, opening for the power stroke and
    // braking. The local +Y span is foreshortened around the same attached root.
    const recoveryT = clampValue((phaseNorm - context.strokeRecoveryStart)
        / (context.strokeRecoveryEnd - context.strokeRecoveryStart), 0, 1);
    const recovery = Math.sin(recoveryT * Math.PI) ** 2;
    const bank = clampValue(Number(fishInfo.banking) || 0, -0.35, 0.35);
    const pitch = (isMain ? 0.16 + recovery * 0.96 * stationKeeping : 0.2 + recovery * 0.22)
        * (1 - pectoralBrake * 0.85) + bank * sideIndex * 0.65;
    const projectedSpan = Math.max(0.38, Math.cos(pitch));
    sprite.scale.set(
        context.scaleRatio * localScale * finLengthScale,
        context.scaleRatio * localScale * sideIndex * finSideScale * projectedSpan,
    );

    const baseAngle = isMain ? (cfg.pectoralAngle ?? 0.7) : (cfg.ventralAngle ?? 0.7);
    const bendClamp = Math.max(-0.6, Math.min(0.6, bend));
    const poseFeather = isMain ? pectoralBrake * 0.16 - pectoralDrive * 0.05 : 0;
    const fl = bendClamp * 0.45 + finWave + foldOffset + poseFeather;
    const finAngle = clampValue(baseAngle + fl, -1.4, 2.2);
    sprite.rotation = spinePos.angle + (sideIndex * finAngle);
};
