import { useCallback, useMemo } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useToast } from '@/ui-kit';
import {
    buildLearningReport,
    buildDeepLearningReportText,
} from '../../model/ZenLearningReports';

export function useZenReportController({
    brain = null,
    pairwiseBrain = null,
    abHistory = [],
    abRoundCount = 0,
    trainingCount = 0,
    pairwiseTrainingCount = 0,
    sessionCalibration = null,
    latestOptimization = null,
    sakuraV2Gate = null,
    redundancyTuning = null,
    treeType = 'sakura',
    optimizationLog = [],
    likedCollection = [],
    currentPhenotype = {},
    analyzedCandidate = null,
    scoreView = null,
} = {}) {
    const { t } = useAppTranslation('main');
    const toast = useToast();

    const learningReport = useMemo(() => buildLearningReport({
        abHistory,
        abRoundCount,
        trainingCount,
        pairwiseTrainingCount,
        sessionCalibration,
        latestOptimization,
        sakuraV2Gate,
        redundancyTuning,
    }), [
        abHistory,
        abRoundCount,
        trainingCount,
        pairwiseTrainingCount,
        sessionCalibration,
        latestOptimization,
        sakuraV2Gate,
        redundancyTuning,
    ]);

    const getDeepLearningReportText = useCallback(() => buildDeepLearningReportText({
        brain,
        pairwiseBrain,
        abHistory,
        treeType,
        optimizationLog,
        likedCollection,
        pairwiseTrainingCount,
        sakuraV2Gate,
        redundancyTuning,
        currentPhenotype,
        analyzedCandidate,
        scoreView,
    }), [
        brain,
        pairwiseBrain,
        abHistory,
        treeType,
        optimizationLog,
        likedCollection,
        pairwiseTrainingCount,
        sakuraV2Gate,
        redundancyTuning,
        currentPhenotype,
        analyzedCandidate,
        scoreView,
    ]);

    const copyText = useCallback(async (text, successMessage) => {
        const payload = typeof text === 'string' ? text : String(text ?? '');
        if (!payload.trim()) return;

        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(payload);
                toast.success(successMessage, { dedupeKey: `report-copy:${successMessage}` });
                return;
            } catch {
                // Continue to the synchronous clipboard path.
            }
        }

        if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
            const textarea = document.createElement('textarea');
            textarea.value = payload;
            textarea.setAttribute('readonly', 'readonly');
            textarea.style.position = 'fixed';
            textarea.style.top = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            const copied = document.execCommand('copy');
            document.body.removeChild(textarea);

            if (copied) {
                toast.success(successMessage, { dedupeKey: `report-copy:${successMessage}` });
                return;
            }
        }

        toast.error(t('core_status.toast.copy_failed'), { dedupeKey: 'report-copy-failed' });
    }, [t, toast]);

    const handleCopyLearningReport = useCallback(() => {
        void copyText(learningReport.text, t('core_status.toast.learning_report_copied'));
    }, [learningReport.text, copyText, t]);

    const handleCopyDeepLearningReport = useCallback(() => {
        void copyText(getDeepLearningReportText(), t('core_status.toast.deep_learning_report_copied'));
    }, [getDeepLearningReportText, copyText, t]);

    const questionQualityWarning = useMemo(() => {
        const reportWarning = Array.isArray(learningReport?.qualityWarnings)
            ? learningReport.qualityWarnings[0]
            : null;
        if (typeof reportWarning === 'string' && reportWarning.trim()) {
            return reportWarning.trim();
        }
        const pairCount = Number(learningReport?.redundancy?.pairCount || 0);
        if (pairCount <= 0) {
            return null;
        }
        const topPair = learningReport?.redundancy?.topPair || null;
        const simPercent = Math.round(Number(topPair?.similarity || 0) * 100);
        if (topPair?.aLabel && topPair?.bLabel) {
            return `질문 품질 경고: 중복 축 ${topPair.aLabel} <-> ${topPair.bLabel} (ATE ${simPercent}%) 감지. 비중복 축 우선으로 질문을 재구성 중입니다.`;
        }
        return `질문 품질 경고: 중복 축 ${pairCount}쌍 감지. 비중복 축 우선으로 질문을 재구성 중입니다.`;
    }, [learningReport]);

    return {
        learningReport,
        getDeepLearningReportText,
        handleCopyLearningReport,
        handleCopyDeepLearningReport,
        questionQualityWarning,
    };
}
