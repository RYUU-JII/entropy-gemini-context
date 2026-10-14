import React, { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';

const ReadingSpace = createContext(null);

export function ZenHomeReadingSpace({ space, rootRef, children }) {
  return <ReadingSpace.Provider value={{ space, rootRef }}>{children}</ReadingSpace.Provider>;
}

// CSS geometry only; no current paint/alpha sampling and no business cache.
export function ZenReadingBlock({ as: Tag = 'div', children, style, ...props }) {
  const context = useContext(ReadingSpace);
  const ref = useRef(null);
  const [width, setWidth] = useState(null);
  useLayoutEffect(() => {
    if (context === null || context.space === null) return undefined;
    const root = context.rootRef.current, node = ref.current;
    const measure = () => {
      if (node.getClientRects().length === 0) return;
      const origin = root.getBoundingClientRect(), bounds = node.getBoundingClientRect();
      const top = bounds.top - origin.top, bottom = bounds.bottom - origin.top;
      let right = context.space.width;
      for (const band of context.space.bands) {
        if (band.bottom + 16 >= top && band.top - 16 <= bottom) right = Math.min(right, band.right - 16);
      }
      const next = Math.max(0, Math.min(context.space.width - (bounds.left - origin.left) - 24, right - (bounds.left - origin.left)));
      setWidth(previous => previous !== null && Math.abs(previous - next) < 0.5 ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll('[data-zen-reading-block]').forEach(block => observer.observe(block));
    return () => observer.disconnect();
  });
  return <Tag {...props} ref={ref} data-zen-reading-block style={{ ...style, ...(width === null ? {} : { width: `${width}px` }) }}>{children}</Tag>;
}
