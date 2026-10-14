import { ZenLearningInsightPanel } from './ZenLearningInsightPanel';
import { ZenArchetypeSetPanel } from './ZenArchetypeSetPanel';

export function hasZenArchetypeSet(latestOptimization = null) {
    return Array.isArray(latestOptimization?.archetypeSet)
        && latestOptimization.archetypeSet.length > 0;
}

export function ZenClassicWorkspacePanels({
    experimental = false,
    showAdvancedControls = false,
    showInsight = false,
    learningReport = null,
    formatPercent = null,
    onCopyLearningReport = null,
    onCopyDeepLearningReport = null,
    latestOptimization = null,
    isCollectionMode = false,
    treeSeed = 0,
    onApplyArchetype = null,
}) {
    if (!experimental || !showAdvancedControls || isCollectionMode) {
        return null;
    }

    const showArchetypeSet = !isCollectionMode && hasZenArchetypeSet(latestOptimization);
    if (!showInsight && !showArchetypeSet) {
        return null;
    }

    return (
        <div
            className="absolute inset-x-2 bottom-2 z-30 max-h-[58%] space-y-2 overflow-y-auto rounded-[16px] bg-[#F8F7F2]/88 p-1.5 shadow-[0_18px_52px_rgba(45,55,43,0.16)] backdrop-blur-md"
            aria-label="Classic experiment review panels"
        >
            {showInsight && (
                <ZenLearningInsightPanel
                    learningReport={learningReport}
                    formatPercent={formatPercent}
                    onCopyLearningReport={onCopyLearningReport}
                    onCopyDeepLearningReport={onCopyDeepLearningReport}
                />
            )}
            {showArchetypeSet && (
                <ZenArchetypeSetPanel
                    archetypeSet={latestOptimization.archetypeSet}
                    method={latestOptimization?.archetypeMethod}
                    formatPercent={formatPercent}
                    activeSeed={treeSeed}
                    onApplyArchetype={onApplyArchetype}
                />
            )}
        </div>
    );
}

export default ZenClassicWorkspacePanels;
