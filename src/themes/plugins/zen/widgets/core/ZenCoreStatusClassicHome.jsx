import { lazy, Suspense } from 'react';

const ZenCoreStatusClassicHomeRuntime = lazy(
    () => import('./ZenCoreStatusClassicHomeRuntime.jsx'),
);

function ZenClassicHomeRuntimeFallback({ frameVariant = 'card' }) {
    const isSlabAperture = frameVariant === 'slab-aperture';
    return (
        <div
            aria-busy="true"
            className={`h-full w-full overflow-hidden bg-surface-sunken/80 animate-pulse ${
                isSlabAperture ? '' : 'rounded-[28px]'
            }`}
        />
    );
}

export default function ZenCoreStatusClassicHome(props) {
    return (
        <Suspense fallback={<ZenClassicHomeRuntimeFallback frameVariant={props?.frameVariant} />}>
            <ZenCoreStatusClassicHomeRuntime {...props} />
        </Suspense>
    );
}
