import { useCallback, useMemo, useRef, useState } from 'react';
import {
    round,
    clamp01,
    safeLabel,
    DEFAULT_QUERY_TUNING,
    sanitizeQueryTuning,
} from '../../../model/ABControllerUtils';
import {
    createQuestionQualityState,
    appendQuestionQualityEvent,
    summarizeQuestionQuality,
} from '../../../model/QuestionQualityMonitor';

export function useZenABQuestionQualityState({
    abQueryTuning = null,
}) {
    const queryTuning = useMemo(
        () => sanitizeQueryTuning(abQueryTuning || DEFAULT_QUERY_TUNING),
        [abQueryTuning],
    );
    const [sessionCalibration, setSessionCalibration] = useState({
        anchorResponses: 0,
        anchorConsistency: 1,
        drift: 0,
    });
    const anchorStatsRef = useRef({
        total: 0,
        choiceCounts: { A: 0, B: 0 },
        consistency: 1,
    });
    const questionQualityRef = useRef(createQuestionQualityState());
    const [questionQuality, setQuestionQuality] = useState(
        questionQualityRef.current.summary,
    );

    const resetAnchorStats = useCallback(() => {
        anchorStatsRef.current = {
            total: 0,
            choiceCounts: { A: 0, B: 0 },
            consistency: 1,
        };
        setSessionCalibration({
            anchorResponses: 0,
            anchorConsistency: 1,
            drift: 0,
        });
        questionQualityRef.current = {
            ...questionQualityRef.current,
            summary: summarizeQuestionQuality({
                events: questionQualityRef.current.events,
                anchorDrift: 0,
            }),
        };
        setQuestionQuality(questionQualityRef.current.summary);
    }, []);

    const updateAnchorCalibration = useCallback((preferredLabelRaw) => {
        const preferredLabel = safeLabel(preferredLabelRaw);
        const nextStats = {
            ...anchorStatsRef.current,
            total: anchorStatsRef.current.total + 1,
            choiceCounts: {
                ...anchorStatsRef.current.choiceCounts,
                [preferredLabel]: (anchorStatsRef.current.choiceCounts?.[preferredLabel] || 0) + 1,
            },
        };
        const majority = Math.max(
            nextStats.choiceCounts?.A || 0,
            nextStats.choiceCounts?.B || 0,
        );
        const consistency = clamp01(majority / Math.max(1, nextStats.total));
        nextStats.consistency = consistency;
        anchorStatsRef.current = nextStats;
        setSessionCalibration({
            anchorResponses: nextStats.total,
            anchorConsistency: round(consistency, 3),
            drift: round(1 - consistency, 3),
        });
    }, []);

    const calibrationWeight = useMemo(
        () => round(0.64 + clamp01(sessionCalibration.anchorConsistency) * 0.36, 4),
        [sessionCalibration.anchorConsistency],
    );

    const updateQuestionQuality = useCallback((event = null) => {
        const anchorDrift = round(
            1 - clamp01(anchorStatsRef.current?.consistency ?? 1),
            4,
        );
        if (event) {
            questionQualityRef.current = appendQuestionQualityEvent(
                questionQualityRef.current,
                event,
                { anchorDrift },
            );
        } else {
            questionQualityRef.current = {
                ...questionQualityRef.current,
                summary: summarizeQuestionQuality({
                    events: questionQualityRef.current.events,
                    anchorDrift,
                }),
            };
        }
        setQuestionQuality(questionQualityRef.current.summary);
        return questionQualityRef.current.summary;
    }, []);

    return {
        queryTuning,
        bestWorstInterval: queryTuning.bestWorstInterval,
        anchorInterval: queryTuning.anchorInterval,
        minSpecialRound: queryTuning.minSpecialRound,
        specialStrength: queryTuning.specialStrength,
        sessionCalibration,
        anchorStatsRef,
        questionQualityRef,
        questionQuality,
        resetAnchorStats,
        updateAnchorCalibration,
        calibrationWeight,
        updateQuestionQuality,
    };
}

export default useZenABQuestionQualityState;
