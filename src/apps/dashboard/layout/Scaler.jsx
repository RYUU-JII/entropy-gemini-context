import React from 'react';

// Aspect Ratio Configuration
const RATIO_W = 16;
const RATIO_H = 9;

export default function Scaler({
  children,
  enabled = true,
  animateResize = true,
  mode = 'landscape',
  background = null,
  marginX = 50,
  marginY = 50,
  marginTop = marginY,
  marginRight = marginX,
  marginBottom = marginY,
  marginLeft = marginX,
}) {
  const isPortrait = mode === 'portrait';
  const horizontalMargin = Math.max(0, marginLeft + marginRight);
  const verticalMargin = Math.max(0, marginTop + marginBottom);

  if (!enabled || isPortrait) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{
          height: '100%',
          width: '100%',
        }}
      >
        <div className="absolute inset-0 z-0 pointer-events-none">
          {background}
        </div>
        <div
          className="relative z-10 h-full w-full"
          style={{
            boxSizing: 'border-box',
            padding: `${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px`,
          }}
        >
          <div className="relative h-full w-full overflow-visible">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        padding: `${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px`,
      }}
    >
      <div className="absolute inset-0 z-0 pointer-events-none">
        {background}
      </div>

      <div
        className="relative z-10 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.3)]"
        style={{
          width: `min(calc(100vw - ${horizontalMargin}px), calc((100vh - ${verticalMargin}px) * ${RATIO_W} / ${RATIO_H}))`,
          height: `min(calc(100vh - ${verticalMargin}px), calc((100vw - ${horizontalMargin}px) * ${RATIO_H} / ${RATIO_W}))`,
          // Position inside the actual margin box. A fractional ancestor
          // translate rasterizes paper and canvas edges at different origins.
          transition: animateResize ? 'width 0.3s ease-out, height 0.3s ease-out' : undefined,
        }}
      >
        <div className="w-full h-full overflow-visible relative">
          {children}
        </div>
      </div>
    </div>
  );
}
