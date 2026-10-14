import { lazy, Suspense } from 'react';

import { loadZenCoreStatusClassicExperiment } from '@zen-core-status-classic-experiment-entry';
import ZenCoreStatusClassicHome from './ZenCoreStatusClassicHome';

const ZenCoreStatusClassicExperiment = typeof loadZenCoreStatusClassicExperiment === 'function'
    ? lazy(loadZenCoreStatusClassicExperiment)
    : null;

function ClassicExperimentFallback() {
    return (
        <div className="h-full w-full overflow-hidden rounded-[32px] border border-[#E7E3DA] bg-[#F8F4EC]/80 animate-pulse" />
    );
}

export default function ZenCoreStatusClassic(props) {
    if (!props?.experimental || !ZenCoreStatusClassicExperiment) {
        return <ZenCoreStatusClassicHome {...props} experimental={false} />;
    }

    return (
        <Suspense fallback={<ClassicExperimentFallback />}>
            <ZenCoreStatusClassicExperiment {...props} />
        </Suspense>
    );
}
