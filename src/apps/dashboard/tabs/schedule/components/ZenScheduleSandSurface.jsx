import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

function seededRandom(seed) {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function rakePaths(width, height, seed) {
  if (width <= 0 || height <= 0) return [];
  const random = seededRandom(seed);
  const left = 0.16 + random() * 0.1;
  const right = 0.72 + random() * 0.17;
  const phase = random() * Math.PI;
  const leftWidth = 0.13 + random() * 0.09;
  const rightWidth = 0.12 + random() * 0.1;
  const tilt = random() * 0.4 - 0.2;
  const paths = [];
  // One continuous bed rather than a repeated tile. The seed remains stable
  // through editing; paired lit/shaded edges describe shallow sand relief.
  for (let base = -46; base < height + 46; base += 7.2 * (0.94 + random() * 0.12)) {
    const points = [];
    for (let x = -8; x <= width + 8; x += 8) {
      const u = x / width;
      const v = (base - height * 0.54) / height;
      const bend = 25 * (Math.exp(-(((u - left) / leftWidth) ** 2)) - 0.7 * Math.exp(-(((u - right) / rightWidth) ** 2)));
      const y = base + bend * (0.75 + 0.26 * Math.cos(v * 2.7 + phase))
        + 0.55 * Math.sin(u * 5.7 + phase) + tilt * u * 4;
      points.push(`${points.length ? 'L' : 'M'}${x} ${y.toFixed(2)}`);
    }
    paths.push(points.join(' '));
  }
  return paths;
}

function ZenScheduleSandSurface({ seed, highlight, ridge }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const surface = ref.current;
    const measure = () => {
      const width = surface.clientWidth;
      const height = surface.clientHeight;
      setSize((current) => current.width === width && current.height === height ? current : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);
  const paths = useMemo(() => rakePaths(size.width, size.height, seed), [size, seed]);
  return <svg ref={ref} aria-hidden="true" className="schedule-sand-surface">
    <g fill="none" stroke={`color-mix(in srgb, ${highlight} 90%, transparent)`} strokeWidth="0.9" transform="translate(0 -0.8)">
      {paths.map((path, index) => <path key={index} d={path} />)}
    </g>
    <g fill="none" stroke={`color-mix(in srgb, ${ridge} 30%, transparent)`} strokeWidth="0.72">
      {paths.map((path, index) => <path key={index} d={path} />)}
    </g>
  </svg>;
}

export default React.memo(ZenScheduleSandSurface);
