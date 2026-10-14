import React from 'react';

const SHARED_SVG_PROPS = Object.freeze({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

// 1. Shoji (障子 - 여백의 격자 창문)
const ShojiIcon = (props) => (
  <svg {...SHARED_SVG_PROPS} {...props}>
    {/* Outer Frame */}
    <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" strokeWidth="1.6" />
    {/* Lattice Grid Lines */}
    <path d="M9.2 3.5v17 M14.8 3.5v17 M3.5 9.2h17 M3.5 14.8h17" strokeWidth="1.2" opacity="0.7" />
    {/* Top-left Paper Pane Shimmer */}
    <rect x="4.7" y="4.7" width="3.5" height="3.5" rx="0.5" fill="currentColor" fillOpacity="0.14" stroke="none" />
    <rect x="10.2" y="10.2" width="3.6" height="3.6" rx="0.5" fill="currentColor" fillOpacity="0.1" stroke="none" />
  </svg>
);

// 2. Enso (円相 - closed ring, brush head entering at ~7 o'clock and drying thin)
// Mirrors the toolbar mark in scripts/generate-icons.mjs: the stroke starts at
// 122 degrees, sweeps 370 so the tail tucks back under the head, and tapers to
// 38% width. A stroked path cannot vary its weight, so the ribbon is emitted as
// a filled outer/inner pair.
const EnsoIcon = (props) => (
  <svg {...SHARED_SVG_PROPS} {...props}>
    <path
      d="M7.0 20.1L6.3 19.6L5.7 19.1L5.1 18.5L4.5 17.9L4.1 17.2L3.6 16.5L3.3 15.8L3.0 15.0L2.8 14.2L2.6 13.4L2.5 12.6L2.5 11.8L2.6 11.0L2.7 10.2L2.9 9.4L3.1 8.6L3.5 7.9L3.8 7.1L4.3 6.5L4.8 5.8L5.4 5.2L6.0 4.7L6.6 4.2L7.3 3.7L8.0 3.4L8.8 3.1L9.6 2.8L10.4 2.6L11.2 2.5L12.0 2.5L12.8 2.5L13.6 2.6L14.4 2.8L15.2 3.1L16.0 3.4L16.7 3.7L17.4 4.2L18.0 4.7L18.6 5.2L19.2 5.8L19.7 6.5L20.2 7.1L20.5 7.9L20.9 8.6L21.1 9.4L21.3 10.2L21.4 11.0L21.5 11.8L21.5 12.6L21.4 13.4L21.2 14.2L21.0 15.0L20.7 15.8L20.4 16.5L19.9 17.2L19.5 17.9L18.9 18.5L18.3 19.1L17.7 19.6L17.0 20.1L16.3 20.5L15.6 20.8L14.8 21.1L14.0 21.3L13.2 21.4L12.4 21.5L11.6 21.5L10.8 21.4L10.0 21.3L9.2 21.1L8.4 20.8L7.7 20.4L6.9 20.0L6.3 19.6L5.6 19.1L6.4 18.2L7.0 18.6L7.6 19.0L8.3 19.2L8.9 19.5L9.6 19.6L10.3 19.7L11.0 19.7L11.7 19.7L12.3 19.6L13.0 19.5L13.6 19.3L14.2 19.0L14.7 18.7L15.3 18.4L15.8 18.0L16.2 17.6L16.6 17.2L17.0 16.7L17.3 16.2L17.6 15.7L17.8 15.1L18.1 14.6L18.3 14.1L18.4 13.6L18.5 13.0L18.6 12.4L18.6 11.9L18.6 11.3L18.5 10.7L18.3 10.2L18.2 9.6L17.9 9.1L17.7 8.6L17.4 8.1L17.0 7.7L16.6 7.3L16.2 6.9L15.7 6.6L15.3 6.3L14.8 6.0L14.2 5.8L13.7 5.6L13.1 5.5L12.6 5.4L12.0 5.4L11.4 5.4L10.9 5.5L10.3 5.6L9.8 5.8L9.2 6.0L8.7 6.3L8.3 6.6L7.8 6.9L7.4 7.3L7.0 7.7L6.6 8.1L6.3 8.6L6.1 9.1L5.8 9.6L5.7 10.2L5.5 10.7L5.4 11.3L5.4 11.9L5.4 12.4L5.5 13.0L5.6 13.6L5.7 14.1L5.9 14.6L6.2 15.1L6.5 15.6L6.4 16.4L6.4 17.3L6.5 18.2L6.6 19.1L7.0 20.1Z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);

// 3. Tome-Ishi (止め石 - blunt triangular boulder, collar knot, straw whisk spire)
// The runtime widget's silhouette is a rounded-triangular river boulder with a
// tight knot at the apex and six straw strands fanning upward roughly as tall as
// the stone. The binding cords that run down the stone body are dropped here:
// at 20px they turn the whole mark into a woven basket.
// See src/themes/plugins/zen/widgets/tools/TomeIshi.jsx.
const TomeIshiIcon = (props) => (
  <svg {...SHARED_SVG_PROPS} {...props}>
    {/* Boulder */}
    <path
      d="M12.6 11.7c2.2.6 4.7 3 6.1 5.4 1 1.7.5 2.5-.9 2.5H6.1c-1.4 0-1.9-.9-1.1-2.3 1.5-2.6 4.4-5.5 7.6-5.6Z"
      strokeWidth="1.55"
    />
    {/* Collar knot at the apex */}
    <path d="M11.2 10.4h3.1v1.4h-3.1z" strokeWidth="1.35" />
    {/* Straw whisk spire */}
    <path
      d="M11.4 10.3 9.6 3.3M12.3 10.3 11.9 2.5M13.2 10.3 14.6 2.9M14 10.3 16.2 4.3"
      strokeWidth="1.25"
      opacity="0.9"
    />
  </svg>
);

// 4. Ishidouro (石灯籠 - kasa, hibukuro with its hi-mado, sao, kiso)
// Same construction as the Zen sidebar's artifact-room sigil so the room and the
// artifact read as one object. See src/themes/core/data/ZenNavigationSigil.jsx.
const IshidouroIcon = (props) => (
  <svg {...SHARED_SVG_PROPS} {...props}>
    {/* Kasa (roof) */}
    <path d="M9.6 5h4.8L18.8 8.3H5.2Z" strokeWidth="1.5" />
    {/* Hibukuro (fire box) and its hi-mado aperture */}
    <path d="M9.2 8.7h5.6v5.6H9.2Z" strokeWidth="1.5" />
    <circle cx="12" cy="11.5" r="1.45" strokeWidth="1.35" />
    {/* Sao (post) and kiso (base) */}
    <path d="M10.9 14.5v3.6M13.1 14.5v3.6" strokeWidth="1.4" opacity="0.8" />
    <path d="M8 18.6h8" strokeWidth="1.5" />
  </svg>
);

// 5. Shishi-Odoshi (鹿威し - bamboo tube at rest, raised inlet on the left)
// Matches the runtime rig: the cut mouth sits at the LEFT end of the tube
// (SHISHI_ODOSHI_TUBE_MOUTH_X = 21 against a 2..294 body) and the resting pose is
// IDLE_ROTATE = 20 degrees about the pivot, which lifts that left inlet. Water
// therefore falls from above into the raised mouth, not out of the right end.
// See src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiSceneRecipe.jsx
// and zenShishiOdoshiRuntimeRecipe.js.
const ShishiOdoshiIcon = (props) => (
  <svg {...SHARED_SVG_PROPS} {...props}>
    {/* Bamboo tube, left end raised */}
    <path d="M6 9.1 18.2 13.5" strokeWidth="3" />
    {/* Cut mouth at the raised left end */}
    <ellipse
      cx="5.6"
      cy="9"
      rx="1.4"
      ry="2.3"
      transform="rotate(20 5.6 9)"
      strokeWidth="1.35"
    />
    {/* Bamboo nodes */}
    <path d="M10.1 8.9 9 12.1M14.1 10.4l-1.1 3.2" strokeWidth="1.4" />
    {/* Water falling into the mouth from above */}
    <path d="M5.2 1.7v2.1M5.2 5v1.2" strokeWidth="1.3" opacity="0.9" />
    {/* Pivot, post and base */}
    <circle cx="12.1" cy="11.2" r="1" fill="currentColor" stroke="none" />
    <path d="M12.1 12.2v6.9M8.8 19.4h6.6" strokeWidth="1.45" />
  </svg>
);

// 6. Furin (風鈴 - bell jar proportioned from the runtime scene)
// BELL_BODY_PATH in the runtime recipe spans 60 wide by 60 tall with the mouth
// closing to 40, so the bell is a squared dome rather than a hemisphere; the path
// below is that outline scaled by 0.15. Getting this ratio wrong is what made the
// old mark read as a light bulb.
// See src/themes/plugins/zen/widgets/tools/recipes/zenFurinSceneRecipe.jsx.
const FurinIcon = (props) => (
  <svg {...SHARED_SVG_PROPS} {...props}>
    {/* Hanging cord */}
    <path d="M12 2.6v2.8" strokeWidth="1.3" opacity="0.75" />
    {/* Bell body */}
    <path
      d="M7.5 7.5C7.65 6 9 5.4 12 5.4S16.35 6 16.5 7.5C16.65 9.6 16.35 12.6 15 13.8C14.4 14.4 13.5 14.4 12 14.4S9.6 14.4 9 13.8C7.65 12.6 7.35 9.6 7.5 7.5Z"
      strokeWidth="1.55"
    />
    {/* Clapper bead and tanzaku strip */}
    <circle cx="12" cy="16" r="1.15" fill="currentColor" stroke="none" />
    <path d="M12 17.2v1.3" strokeWidth="1.15" />
    <path
      d="M10.5 18.5h3v4.3l-1.5-.9-1.5.9Z"
      strokeWidth="1.3"
      fill="currentColor"
      fillOpacity="0.15"
    />
  </svg>
);

// 7. Suikinkutsu (水琴窟 - 물방울 동심원 파문)
const SuikinkutsuIcon = (props) => (
  <svg {...SHARED_SVG_PROPS} {...props}>
    {/* Falling Water Droplet */}
    <path
      d="M12 3.2c0 0-2 2.6-2 4.1a2 2 0 0 0 4 0c0-1.5-2-4.1-2-4.1Z"
      fill="currentColor"
      stroke="none"
      opacity="0.88"
    />
    {/* Center Splash Core */}
    <circle cx="12" cy="15.2" r="1.2" fill="currentColor" stroke="none" />
    {/* Expanding Water Ripples */}
    <ellipse cx="12" cy="15.2" rx="3.6" ry="1.5" strokeWidth="1.4" />
    <ellipse cx="12" cy="15.2" rx="6.8" ry="2.7" strokeWidth="1.3" opacity="0.72" />
    <ellipse cx="12" cy="15.2" rx="9.6" ry="3.8" strokeWidth="1.1" opacity="0.38" />
  </svg>
);

// 8. Seigaiha (青海波 - the Great Wave / Lethe pattern)
// The runtime widget tiles concentric semi-ellipse wave units (WAVE_RX 36,
// WAVE_RY 22) in offset rows; the icon keeps one full unit with two interlocking
// units behind it, which is the smallest arrangement that still reads as a
// repeating pattern rather than a single arc.
// See src/themes/plugins/zen/widgets/tools/GreatWave.jsx.
const SeigaihaIcon = (props) => (
  <svg {...SHARED_SVG_PROPS} {...props}>
    {/* Upper row, offset by half a unit and clipped by the viewBox */}
    <g strokeWidth="1.3" opacity="0.6">
      <path d="M-2.8 13.1A7.4 4.6 0 0 1 12 13.1" />
      <path d="M-0.33 13.1A4.93 3.07 0 0 1 9.53 13.1" />
      <path d="M2.13 13.1A2.47 1.53 0 0 1 7.07 13.1" />
      <path d="M12 13.1A7.4 4.6 0 0 1 26.8 13.1" />
      <path d="M14.47 13.1A4.93 3.07 0 0 1 24.33 13.1" />
      <path d="M16.93 13.1A2.47 1.53 0 0 1 21.87 13.1" />
    </g>
    {/* Front unit */}
    <g strokeWidth="1.4">
      <path d="M4.6 18.2A7.4 4.6 0 0 1 19.4 18.2" />
      <path d="M7.07 18.2A4.93 3.07 0 0 1 16.93 18.2" />
      <path d="M9.53 18.2A2.47 1.53 0 0 1 14.47 18.2" />
    </g>
  </svg>
);

const ZEN_ICON_MAP = Object.freeze({
  // 1. Lens / Shoji
  lens: ShojiIcon,
  shoji: ShojiIcon,

  // 2. Veil / Enso
  veil: EnsoIcon,
  enso: EnsoIcon,

  // 3. Brake / Tome-Ishi
  brake: TomeIshiIcon,
  tomeIshi: TomeIshiIcon,
  tome_ishi: TomeIshiIcon,
  rhythmBrake: TomeIshiIcon,
  rhythm_brake: TomeIshiIcon,

  // 4. Barrier / Ishidouro / Monolith
  barrier: IshidouroIcon,
  monolith: IshidouroIcon,
  ishidouro: IshidouroIcon,
  timeAnchor: IshidouroIcon,
  time_anchor: IshidouroIcon,

  // 5. Gate / Shishi-Odoshi / LoopBreaker
  gate: ShishiOdoshiIcon,
  shishiOdoshi: ShishiOdoshiIcon,
  shishi_odoshi: ShishiOdoshiIcon,
  loopBreaker: ShishiOdoshiIcon,
  loop_breaker: ShishiOdoshiIcon,

  // 6. Flare / Furin / SentinelFlare
  flare: FurinIcon,
  furin: FurinIcon,
  sentinelFlare: FurinIcon,
  sentinel_flare: FurinIcon,

  // 7. Echo / Lethe / GreatWave - the shipped artifact whose canonical id is
  // 'echo' and whose visualKey is 'lethe'. The gallery quick bar addresses it by
  // canonical id, so 'echo' is the key that actually renders and it belongs to
  // the Seigaiha wave, not to the water-drop mark.
  // See src/themes/core/tools/artifacts.js.
  echo: SeigaihaIcon,
  lethe: SeigaihaIcon,
  memoryPurge: SeigaihaIcon,
  memory_purge: SeigaihaIcon,
  greatWave: SeigaihaIcon,
  great_wave: SeigaihaIcon,

  // 8. Suikinkutsu - not shipped today; the water-drop mark is reserved for it.
  suikinkutsu: SuikinkutsuIcon,
  resonance: SuikinkutsuIcon,
});

export default function ArtifactIcons({ artifactKey, className, color, ...props }) {
  const normalizedKey = typeof artifactKey === 'string' ? artifactKey.trim() : '';
  const Icon = ZEN_ICON_MAP[normalizedKey] || ZEN_ICON_MAP[normalizedKey.toLowerCase()];
  if (!Icon) return null;
  return <Icon className={className} color={color} {...props} />;
}
