import React, { Suspense } from 'react';

// Home owns the common graph placement; the theme owns its inline favicon action.
export default function ZenHomePressureDock({
  layoutFrame,
  railSlotRef,
  RailComponent,
  railProps,
  pendingContent = null,
  presented = true,
}) {
  return (
      <div
        ref={railSlotRef}
        className="zen-home-pressure-slot relative h-[34px] min-h-[34px]"
        data-main-presentation-layer="rhythm"
        data-main-presentation-surface="pressure-rail"
        data-layout-ready={layoutFrame !== null}
        inert={!presented} aria-hidden={!presented}
        style={{ visibility: presented ? undefined : 'hidden', ...(layoutFrame ? {
          '--zen-home-pressure-data-width': `${layoutFrame.dataRect.width}px`,
        } : {}) }}
      >
        <div className="zen-home-pressure-data">
          <Suspense fallback={pendingContent}>
            <RailComponent {...railProps} dataWidth={layoutFrame?.dataRect.width ?? null} />
          </Suspense>
        </div>
      </div>
  );
}
