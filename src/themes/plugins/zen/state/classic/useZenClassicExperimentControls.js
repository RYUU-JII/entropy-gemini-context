import { useEffect, useMemo, useState } from 'react';

import {
    DEFAULT_AB_EXPLORATION_INTENSITY,
    DEFAULT_AB_QUERY_TUNING,
    DEFAULT_CANOPY_DISTRIBUTION_TUNING,
    DEFAULT_REDUNDANCY_TUNING,
    persistABQueryTuning,
    persistCanopyDistributionTuning,
    persistRedundancyTuning,
    readABQueryTuning,
    readCanopyDistributionTuning,
    readRedundancyTuning,
} from '../../model/ZenCoreConfig';
import {
    DEFAULT_SAKURA_V2_FLAGS,
    persistSakuraV2Flags,
    readSakuraV2Flags,
    resolveWorkerFallbackPolicy,
} from '../../model/SakuraV2Runtime';
import {
    listSakuraLearningLatentKeys,
    resolveSakuraLearningLatentProfile,
} from '../../model/v2/SakuraLatentParamApi';
import { useZenClassicSpineGuideDraft } from './useZenClassicSpineGuideDraft';

export function useZenClassicExperimentControls({
    treeType = 'sakura',
} = {}) {
    const spineGuideDraft = useZenClassicSpineGuideDraft();
    const [isCollectionMode, setIsCollectionMode] = useState(false);
    const [abExplorationIntensity, setAbExplorationIntensity] = useState(DEFAULT_AB_EXPLORATION_INTENSITY);
    const [abQueryTuning, setAbQueryTuning] = useState(() => {
        return readABQueryTuning(treeType);
    });
    const [redundancyTuning, setRedundancyTuning] = useState(() => {
        return readRedundancyTuning(treeType);
    });
    const [canopyDistributionTuning, setCanopyDistributionTuning] = useState(() => {
        return readCanopyDistributionTuning(treeType);
    });
    const [sakuraV2Flags, setSakuraV2Flags] = useState(() => readSakuraV2Flags());

    useEffect(() => {
        persistSakuraV2Flags(sakuraV2Flags || DEFAULT_SAKURA_V2_FLAGS);
    }, [sakuraV2Flags]);

    useEffect(() => {
        if (treeType !== 'sakura') {
            return;
        }
        persistABQueryTuning(treeType, abQueryTuning || DEFAULT_AB_QUERY_TUNING);
    }, [treeType, abQueryTuning]);

    useEffect(() => {
        if (treeType !== 'sakura') {
            return;
        }
        persistRedundancyTuning(treeType, redundancyTuning || DEFAULT_REDUNDANCY_TUNING);
    }, [treeType, redundancyTuning]);

    useEffect(() => {
        if (treeType !== 'sakura') {
            return;
        }
        persistCanopyDistributionTuning(treeType, canopyDistributionTuning || DEFAULT_CANOPY_DISTRIBUTION_TUNING);
    }, [treeType, canopyDistributionTuning]);

    const learningKeyspaceProfile = useMemo(
        () => resolveSakuraLearningLatentProfile(sakuraV2Flags?.learningKeyspaceProfile),
        [sakuraV2Flags?.learningKeyspaceProfile],
    );
    const workerFallbackPolicy = useMemo(
        () => resolveWorkerFallbackPolicy(sakuraV2Flags?.workerFallbackPolicy),
        [sakuraV2Flags?.workerFallbackPolicy],
    );
    const learningLatentKeys = useMemo(
        () => listSakuraLearningLatentKeys({ profile: learningKeyspaceProfile }),
        [learningKeyspaceProfile],
    );

    return {
        isCollectionMode,
        setIsCollectionMode,
        abExplorationIntensity,
        setAbExplorationIntensity,
        abQueryTuning,
        setAbQueryTuning,
        redundancyTuning,
        setRedundancyTuning,
        canopyDistributionTuning,
        setCanopyDistributionTuning,
        sakuraV2Flags,
        setSakuraV2Flags,
        learningKeyspaceProfile,
        workerFallbackPolicy,
        learningLatentKeys,
        ...spineGuideDraft,
    };
}

export default useZenClassicExperimentControls;
