import { lazy, Suspense } from 'react';

const ZenBonsaiPreviewRuntime = lazy(
    () => import('../../runtime/preview/ZenBonsaiPreviewRuntime.jsx'),
);

export default function ZenBonsaiPreview(props) {
    return (
        <Suspense fallback={null}>
            <ZenBonsaiPreviewRuntime {...props} />
        </Suspense>
    );
}
