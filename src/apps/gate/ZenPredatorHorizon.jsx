import React, { useId, useMemo } from 'react';

function angularDistance(angle, centre) {
  return Math.atan2(Math.sin(angle - centre), Math.cos(angle - centre));
}

// All phases share quadratic commands: light, fill and mask interpolate together.
// Selection changes geometry once; CSS owns the finite presentation sequence.
function predatorContour(phase, seats = [], { crest = false } = {}) {
  const count = crest ? 48 : 128;
  const start = crest ? 3.43 : 0;
  const sweep = crest ? 1.72 : Math.PI * 2;
  const points = Array.from({ length: count }, (_, index) => {
    const angle = start + sweep * index / (crest ? count - 1 : count);
    let radius = (crest ? 335 : 332) + 2.2 * Math.sin(angle * 3 + .8) + 1.2 * Math.sin(angle * 7 - 1.1);
    if (phase === 'opening') {
      radius -= 38 * Math.exp(-.5 * (angularDistance(angle, 3.72) / .3) ** 2);
      radius += 14 * Math.exp(-.5 * (angularDistance(angle, 2.44) / .4) ** 2);
    }
    if (phase === 'feeding' && seats.length > 0) {
      const width = Math.min(.11, .44 / seats.length);
      seats.forEach((seat) => {
        radius -= 42 * Math.exp(-.5 * (angularDistance(angle, seat) / width) ** 2);
      });
    }
    return [500 + Math.cos(angle) * radius, 500 + Math.sin(angle) * radius];
  });
  const coordinate = ([x, y]) => x.toFixed(2) + ' ' + y.toFixed(2);
  const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let path = 'M ' + coordinate(crest ? points[0] : midpoint(points.at(-1), points[0]));
  points.forEach((point, index) => {
    const next = index === points.length - 1 ? (crest ? point : points[0]) : points[index + 1];
    path += ' Q ' + coordinate(point) + ' ' + coordinate(midpoint(point, next));
  });
  return path + (crest ? '' : ' Z');
}

const REST_CONTOUR = predatorContour('rest');
const OPEN_CONTOUR = predatorContour('opening');
const REST_CREST = predatorContour('rest', [], { crest: true });
const OPEN_CREST = predatorContour('opening', [], { crest: true });

// Exterior currents remain sparse even while the boundary folds inward.
const PLASMA_FILAMENTS = Array.from({ length: 7 }, (_, strand) => {
  const points = Array.from({ length: 81 }, (_, index) => {
    const progress = index / 80;
    const angle = ((116 - strand * 9 + progress * (223 + strand * 5)) * Math.PI) / 180;
    const envelope = Math.sin(progress * Math.PI);
    const radius = 335 + strand * 2.4 + envelope * (
      4 + 5 * Math.sin(angle * 5 + strand * 1.7) + 2.5 * Math.sin(angle * 13 - strand)
    );
    return [500 + Math.cos(angle) * radius, 500 + Math.sin(angle) * radius];
  });
  const coordinate = ([x, y]) => x.toFixed(2) + ' ' + y.toFixed(2);
  let path = 'M ' + coordinate(points[0]);
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    path += ' Q ' + coordinate(point) + ' ' + coordinate([(point[0] + next[0]) / 2, (point[1] + next[1]) / 2]);
  }
  return path + ' L ' + coordinate(points.at(-1));
});

/** A local pull at the selected seat, sharing the rim's responsive geometry. */
export function ZenPredatorIntake({ seatStyle }) {
  return (
    <span className="zen-predator-intake" style={seatStyle} aria-hidden="true">
      <svg className="zen-predator-intake__light" viewBox="-88 -64 128 128" fill="none">
        <path className="zen-predator-intake__halo" d="M -7 -50 C -10 -26 -34 -12 -42 0 C -34 12 -10 26 -7 50" />
        <path className="zen-predator-intake__lip" d="M -7 -50 C -10 -26 -34 -12 -42 0 C -34 12 -10 26 -7 50" />
        <path className="zen-predator-intake__thread" d="M -4 -30 C -14 -12 -27 -5 -68 0 C -30 5 -16 14 -4 30" />
        <path className="zen-predator-intake__thread" d="M -7 -18 Q -41 -3 -80 0 Q -41 3 -7 18" />
      </svg>
    </span>
  );
}

/** The sleeping lantern core unfolded: white light surrounding an absent interior. */
export default function ZenPredatorHorizon({ seatStyles }) {
  const id = useId().replaceAll(':', '');
  const paint = (name) => 'url(#' + id + '-' + name + ')';
  const contours = useMemo(() => {
    const angles = (u, v) => seatStyles.map((seat) => Math.atan2(Number(seat[v]), Number(seat[u])));
    const wide = angles('--orbit-u', '--orbit-v');
    const narrow = angles('--orbit-narrow-u', '--orbit-narrow-v');
    return {
      '--horizon-rest': `path("${REST_CONTOUR}")`,
      '--horizon-opening': `path("${OPEN_CONTOUR}")`,
      '--horizon-feeding-wide': `path("${predatorContour('feeding', wide)}")`,
      '--horizon-feeding-narrow': `path("${predatorContour('feeding', narrow)}")`,
      '--crest-rest': `path("${REST_CREST}")`,
      '--crest-opening': `path("${OPEN_CREST}")`,
      '--crest-feeding-wide': `path("${predatorContour('feeding', wide, { crest: true })}")`,
      '--crest-feeding-narrow': `path("${predatorContour('feeding', narrow, { crest: true })}")`,
    };
  }, [seatStyles]);
  return (
    <div className="gate-predator-colossus__horizon" aria-hidden="true">
      <div className="zen-predator-corona" />
      <div className="zen-predator-lensing-glow" />
      <svg className="zen-predator-lensing" viewBox="0 0 1000 1000" fill="none" style={contours}>
        <defs>
          <linearGradient id={id + '-rim'} x1="235" y1="190" x2="775" y2="810" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset=".24" stopColor="#f8fafc" />
            <stop offset=".52" stopColor="#b8c2cb" stopOpacity=".78" />
            <stop offset=".78" stopColor="#6b7682" stopOpacity=".3" />
            <stop offset="1" stopColor="#414951" stopOpacity=".08" />
          </linearGradient>
          <linearGradient id={id + '-field'} x1="100" y1="350" x2="780" y2="720" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e3e8ed" stopOpacity="0" />
            <stop offset=".32" stopColor="#e3e8ed" stopOpacity=".55" />
            <stop offset=".64" stopColor="#c4cdd6" stopOpacity=".22" />
            <stop offset="1" stopColor="#c4cdd6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id + '-crest'} x1="180" y1="410" x2="638" y2="190" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f8fafc" stopOpacity="0" />
            <stop offset=".24" stopColor="#ffffff" />
            <stop offset=".62" stopColor="#ffffff" />
            <stop offset="1" stopColor="#f8fafc" stopOpacity="0" />
          </linearGradient>
          <filter id={id + '-bloom'} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="13" result="wide" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="near" />
            <feMerge>
              <feMergeNode in="wide" />
              <feMergeNode in="near" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={id + '-haze'} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="25" />
          </filter>
          <filter id={id + '-grain'} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency=".018 .042" numOctaves="2" seed="23" result="grain" />
            <feDisplacementMap in="SourceGraphic" in2="grain" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <mask id={id + '-outside'} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
            <path d="M 0 0 H 1000 V 1000 H 0 Z" fill="white" />
            <path className="zen-predator-boundary" d={REST_CONTOUR} fill="black" />
          </mask>
        </defs>

        {/* The surrounding space bends into the boundary; it has no orbital grid. */}
        <g stroke={paint('field')} strokeLinecap="round">
          <path d="M 30 640 C 70 415 201 134 444 120 C 736 91 947 305 980 409" strokeWidth=".8" opacity=".38" />
          <path d="M 4 694 C 102 453 218 158 467 145 C 737 120 903 285 995 461" strokeWidth="1.2" opacity=".5" />
          <path d="M 5 732 C 170 716 248 814 486 846 C 690 873 850 790 988 600" strokeWidth=".8" opacity=".36" />
          <path d="M 94 841 C 252 738 338 848 521 863 C 692 873 866 778 969 643" strokeWidth=".6" opacity=".23" />
          <path d="M 116 327 C 199 287 288 176 422 156 C 638 124 770 203 883 304" strokeWidth=".7" opacity=".38" />
        </g>

        {/* The light has a precise limit. Nothing is painted inside that limit. */}
        <path className="zen-predator-boundary" d={REST_CONTOUR} stroke={paint('rim')} strokeWidth="32" opacity=".34" filter={paint('haze')} />
        <path className="zen-predator-boundary" d={REST_CONTOUR} fill="#000000" />
        <path className="zen-predator-boundary" d={REST_CONTOUR} stroke={paint('rim')} strokeWidth="7" opacity=".85" filter={paint('bloom')} />
        <path className="zen-predator-boundary" d={REST_CONTOUR} stroke={paint('rim')} strokeWidth="1.6" />

        {/* Different currents travel along a narrow, exterior-only plasma skin. */}
        <g mask={paint('outside')}>
          <g className="zen-predator-plasma" stroke={paint('rim')} strokeLinecap="round" fill="none">
            {PLASMA_FILAMENTS.map((path, index) => (
              <path key={index} className="zen-predator-plasma__strand" d={path} pathLength="100"
                strokeWidth={index % 3 === 0 ? '1.7' : '.85'}
                style={{ '--plasma-duration': (13 + index * 2.7) + 's', '--plasma-delay': (-index * 3.1) + 's',
                  '--plasma-opacity': .72 - index * .065 }} />
            ))}
          </g>
        </g>

        {/* One overexposed crest reveals the same white as the small lantern core. */}
        <g className="zen-predator-crest" filter={paint('grain')}>
          <path className="zen-predator-boundary zen-predator-boundary--crest" d={REST_CREST} stroke={paint('crest')} strokeWidth="5.5" filter={paint('bloom')} />
        </g>
      </svg>

      <div className="zen-predator-dust">
        {Array.from({ length: 14 }, (_, index) => (
          <i
            key={index}
            style={{
              '--dust-angle': ((index * 137.508) % 360) + 'deg',
              '--dust-delay': -(index * 1.71).toFixed(2) + 's',
              '--dust-duration': (16 + (index % 5) * 2.4).toFixed(2) + 's',
              '--dust-radius': (38 + (index % 7) * 2.5) + '%',
            }}
          />
        ))}
      </div>
    </div>
  );
}
