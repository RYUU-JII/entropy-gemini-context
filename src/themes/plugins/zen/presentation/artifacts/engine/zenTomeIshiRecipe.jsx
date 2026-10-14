import React from 'react';
import { motion } from 'framer-motion';

// Sekimori-Ishi (関守石 / 止め石 - Master Tea Garden Stopping Stone)
// Grounded rounded-triangular river boulder bound with multi-strand straw cord,
// a tightly coiled collar knot at the apex, and a stiff upward straw whisk spire.

// 1. Natural Boulder Silhouette & Shading Paths (Organic River Pebble - blunt dome, wide grounded base)
const BOULDER_BODY_PATH = 'M176 142C188 143 212 165 226 196C236 218 240 236 234 246C226 253 196 252 160 251C128 250 112 248 106 240C98 226 110 204 124 182C140 156 162 141 176 142Z';
const BOULDER_CORE_SHADOW_PATH = 'M176 142C188 143 212 165 226 196C236 218 240 236 234 246C226 253 206 252 186 251C200 236 210 210 206 188C202 168 188 148 176 142Z';
const BOULDER_HIGHLIGHT_PATH = 'M176 142C162 141 140 156 124 182C110 204 98 226 106 240C110 232 118 212 132 188C146 164 164 146 176 142Z';
const BOULDER_RIM_PATH = 'M106 240C98 226 110 204 124 182C140 156 162 141 176 142';

// 2. Left Diagonal Leather Strap (Under-layer bundle, Bottom at X ≈ 144~149 -> Top at X ≈ 164~169)
const LEFT_RIBBON_CORDS = [
  { id: 'lv1', d: 'M169 139C168 152 159 195 149 252', shadowD: 'M166 140C161 178 153 216 146.5 252', width: 2.6, highlightWidth: 0.7 },
  { id: 'lv2', d: 'M166.5 139C165.5 152 156.5 195 146.5 252', shadowD: 'M163.5 140C158.5 178 150.5 216 144 252', width: 2.8, highlightWidth: 0.75 },
  { id: 'lv3', d: 'M164 139C163 152 154 195 144 252', shadowD: 'M161 140C156 178 148 216 141.5 252', width: 2.5, highlightWidth: 0.65 },
];

// 3. Right Diagonal Leather Strap (Over-layer bundle, Bottom at X ≈ 184~190 -> Top at X ≈ 169.5~174.5)
const RIGHT_RIBBON_CORDS = [
  { id: 'rv1', d: 'M169.5 139C171 154 177 195 184 251.5', shadowD: 'M172 140C176 178 181 216 187 251', width: 2.5, highlightWidth: 0.65 },
  { id: 'rv2', d: 'M172 139C173.5 154 179.5 195 187 251', shadowD: 'M174.5 140C178.5 178 183.5 216 189.5 251', width: 2.8, highlightWidth: 0.75 },
  { id: 'rv3', d: 'M174.5 139C176 154 182 195 190 250.5', shadowD: 'M177 140C181 178 186 216 192 250.5', width: 2.6, highlightWidth: 0.65 },
];

// 4. Upward Spire / Whisk Strands (3--2-1 Rhythm Grouping & Roots Converging inside Knot)
const STRAW_WHISK_STRANDS = [
  // Group A (Left 3 tight cluster): Strands 1, 2, 3
  { id: 's1', d: 'M168 117C165 74 160 46 157.5 22', tipX: 157.5, tipY: 22, width: 2.3 },
  { id: 's2', d: 'M169.2 117C167 72 164 43 162 18', tipX: 162, tipY: 18, width: 2.4 },
  { id: 's3', d: 'M170.4 117C169.2 70 167.5 40 166.5 16', tipX: 166.5, tipY: 16, width: 2.3 },
  // Group B (Right cluster - Pair of 2): Strands 4, 5
  { id: 's4', d: 'M171.6 117C174 70 176.5 40 177.5 18', tipX: 177.5, tipY: 18, width: 2.3 },
  { id: 's5', d: 'M172.8 117C176 72 180 43 182.5 22', tipX: 182.5, tipY: 22, width: 2.2 },
  // Group C (Right trailing single 1): Strand 6
  { id: 's6', d: 'M174 117C179 74 187 46 191.5 28', tipX: 191.5, tipY: 28, width: 2.0 },
];

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function blendHex(start, end, amount) {
  const normalize = (value) => {
    const raw = typeof value === 'string' ? value.trim().replace('#', '') : '';
    if (!/^[\da-fA-F]{6}$/.test(raw)) return null;
    return [
      parseInt(raw.slice(0, 2), 16),
      parseInt(raw.slice(2, 4), 16),
      parseInt(raw.slice(4, 6), 16),
    ];
  };
  const from = normalize(start);
  const to = normalize(end);
  if (!from || !to) return start;
  const t = clamp01(amount);
  const channel = (index) => Math.round(from[index] + ((to[index] - from[index]) * t))
    .toString(16)
    .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

export function buildZenTomeIshiScene({ ids, color, visualWeight, nightDepth, shouldAnimate }) {
  // Natural River Stone Palette (Slate/Basalt Grey)
  const stoneBase = blendHex('#4e4b44', '#2a2924', nightDepth);
  const stoneLight = blendHex('#8c877c', '#5e5a52', nightDepth);
  const stoneMid = blendHex('#605c53', '#3d3a34', nightDepth);
  const stoneDark = blendHex('#1e1d19', '#0f0e0c', nightDepth);
  const stoneHighlightOpacity = 0.38 + (visualWeight * 0.15);
  const stoneShadowOpacity = 0.55 + (visualWeight * 0.14);

  // Subdued Natural Leather / Rawhide Palette (Earth Umber)
  const baseLeatherTone = color && color !== '#17191c'
    ? color
    : '#8a6752';
  const cordColor = blendHex(baseLeatherTone, '#63442a', nightDepth * 0.45);
  const cordLight = blendHex('#d9c3ab', '#9e8975', nightDepth * 0.35);
  const cordDark = blendHex('#4a321c', '#221509', nightDepth);
  const cordShadow = blendHex('#12100a', '#050402', nightDepth);

  const stoneFillId = ids.get('stone-fill');
  const cordGradId = ids.get('cord-grad');
  const knotGradId = ids.get('knot-grad');

  const cordPulseAnimation = shouldAnimate
    ? {
      opacity: [0.9, 1, 0.9],
      filter: [
        'drop-shadow(0 0 1px rgba(168,126,91,0.25))',
        'drop-shadow(0 0 4px rgba(226,206,186,0.55))',
        'drop-shadow(0 0 1px rgba(168,126,91,0.25))',
      ],
    }
    : { opacity: 0.92 + (visualWeight * 0.08) };

  const sceneNodes = [
    // 1. Karesansui Ground Contact & Deep Ambient Occlusion
    <g key="tome-ishi-contact" data-tome-ishi-contact-baseline="karesansui-center">
      {/* Outer soft sand depression */}
      <ellipse cx="170" cy="251" rx="102" ry="15" fill="#141310" opacity={0.25 + (visualWeight * 0.06)} />
      {/* Mid ground occlusion shadow */}
      <ellipse cx="170" cy="252" rx="78" ry="9" fill="#0d0c0a" opacity={0.48 + (visualWeight * 0.1)} />
      {/* Direct stone embed contact rim */}
      <ellipse cx="170" cy="253" rx="56" ry="5" fill="#050504" opacity={0.75 + (visualWeight * 0.14)} />
    </g>,

    // 2. Organic Rounded River Stone Body
    <g
      key="tome-ishi-boulder"
      data-tome-ishi-stone="sekimori-boulder"
      data-tome-ishi-surface="zen-cairn-stone-svg"
    >
      {/* Main Boulder Base */}
      <path d={BOULDER_BODY_PATH} fill={`url(#${stoneFillId})`} />

      {/* Directional Soft Core Shadow (Bottom-Right) */}
      <path d={BOULDER_CORE_SHADOW_PATH} fill={stoneDark} opacity={stoneShadowOpacity} />

      {/* Directional Soft Light Zone (Top-Left) */}
      <path d={BOULDER_HIGHLIGHT_PATH} fill={stoneLight} opacity={stoneHighlightOpacity} />

      {/* Crisp Outline */}
      <path
        d={BOULDER_BODY_PATH}
        fill="none"
        stroke="#1c1b16"
        strokeOpacity="0.5"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Sunlit Rim Light Edge */}
      <path
        d={BOULDER_RIM_PATH}
        fill="none"
        stroke={stoneLight}
        strokeOpacity={0.55 + (visualWeight * 0.15)}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>,

    // 3. Strap Drop Shadows on Stone Face (Provides Realistic 3D Contact)
    <g key="tome-ishi-cord-shadows" data-tome-ishi-cord="contact-shadow" opacity={0.55}>
      {/* Left Strap Shadow (starts wide at X=145.5, converges to X=166.5 at top) */}
      <path d="M166 140C160 178 152 216 145.5 251" fill="none" stroke={cordShadow} strokeWidth={8.5} strokeLinecap="round" />
      {/* Right Strap Shadow (starts wide at X=176.5, converges to X=172 at top) */}
      <path d="M172 140C174 178 175 216 176.5 251" fill="none" stroke={cordShadow} strokeWidth={8.5} strokeLinecap="round" />
      {/* Base band contact shadow along stone crest */}
      <path d="M161 144C167 145.5 174 145.5 180 144" fill="none" stroke={cordShadow} strokeWidth={4.2} strokeLinecap="round" opacity={0.6} />
    </g>,

    // 4. Organic Hand-Tied Triangular Collar Loop (유기적인 끈 흐름, 텐션 곡선 및 다중 가닥 텍스처)
    <g key="tome-ishi-triangular-collar" data-tome-ishi-cord="triangular-collar">
      {/* Base Soft Contact Ambient Occlusion Under the Loop */}
      <path d="M161 142C167 144 174 144 180 142" fill="none" stroke={cordShadow} strokeWidth="4.2" opacity="0.5" strokeLinecap="round" />

      {/* Outer Continuous Sling Loop Strand */}
      {/* Left to Apex with natural tension bow */}
      <path d="M160.5 142.5C161 133 166 126 169.5 120" fill="none" stroke={`url(#${cordGradId})`} strokeWidth="2.3" strokeLinecap="round" />
      <path d="M160.5 142.5C161 133 166 126 169.5 120" fill="none" stroke={cordLight} strokeWidth="0.6" strokeOpacity="0.55" strokeLinecap="round" />

      {/* Right to Apex with natural tension bow */}
      <path d="M180.5 142.5C180 133 175 126 171.5 120" fill="none" stroke={`url(#${cordGradId})`} strokeWidth="2.3" strokeLinecap="round" />
      <path d="M180.5 142.5C180 133 175 126 171.5 120" fill="none" stroke={cordLight} strokeWidth="0.6" strokeOpacity="0.55" strokeLinecap="round" />

      {/* Horizontal Base Band Strand 1 (Outer) */}
      <path d="M160.5 142.5C167 144.5 174 144.5 180.5 142.5" fill="none" stroke={`url(#${cordGradId})`} strokeWidth="2.3" strokeLinecap="round" />
      <path d="M160.5 142.5C167 144.5 174 144.5 180.5 142.5" fill="none" stroke={cordLight} strokeWidth="0.6" strokeOpacity="0.55" strokeLinecap="round" />

      {/* Inner Twin Interlaced Strand (끈 꼬임/두 가닥 결속감 형성) */}
      {/* Left Inner Strand */}
      <path d="M162.5 141.5C163.5 133.5 167.5 126.5 170.5 121" fill="none" stroke={`url(#${cordGradId})`} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M162.5 141.5C163.5 133.5 167.5 126.5 170.5 121" fill="none" stroke={cordLight} strokeWidth="0.55" strokeOpacity="0.5" strokeLinecap="round" />

      {/* Right Inner Strand */}
      <path d="M178.5 141.5C177.5 133.5 173.5 126.5 170.5 121" fill="none" stroke={`url(#${cordGradId})`} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M178.5 141.5C177.5 133.5 173.5 126.5 170.5 121" fill="none" stroke={cordLight} strokeWidth="0.55" strokeOpacity="0.5" strokeLinecap="round" />

      {/* Horizontal Base Band Strand 2 (Inner) */}
      <path d="M162.5 141C167 143 174 143 178.5 141" fill="none" stroke={`url(#${cordGradId})`} strokeWidth="2.0" strokeLinecap="round" />
      <path d="M162.5 141C167 143 174 143 178.5 141" fill="none" stroke={cordLight} strokeWidth="0.5" strokeOpacity="0.5" strokeLinecap="round" />

      {/* Corner Rounded Turn Bends */}
      <circle cx="161" cy="142" r="1.4" fill={cordColor} opacity="0.8" />
      <circle cx="180" cy="142" r="1.4" fill={cordColor} opacity="0.8" />
    </g>,

    // 5. Left Diagonal Leather Strap (Under-layer bundle)
    <g key="tome-ishi-left-ribbon" data-tome-ishi-cord="vertical-band">
      <ellipse cx="166.5" cy="143" rx="4" ry="1.5" fill={cordShadow} opacity={0.45} />
      {LEFT_RIBBON_CORDS.map((cord) => (
        <g key={cord.id}>
          <path
            d={cord.d}
            fill="none"
            stroke={`url(#${cordGradId})`}
            strokeWidth={cord.width}
            strokeLinecap="round"
          />
          <path
            d={cord.d}
            fill="none"
            stroke={cordLight}
            strokeWidth={cord.highlightWidth}
            strokeOpacity={0.65}
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>,

    // Overlap contact shadow between left and right bundles near top
    <path key="tome-ishi-overlap-shadow" d="M168 139C168.5 152 165 175 160 198" fill="none" stroke={cordShadow} strokeWidth={1.6} opacity={0.5} strokeLinecap="round" />,

    // 6. Right Diagonal Leather Strap (Over-layer bundle overlapping left bundle)
    <g key="tome-ishi-right-ribbon" data-tome-ishi-cord="horizontal-band">
      <ellipse cx="172" cy="143" rx="4" ry="1.5" fill={cordShadow} opacity={0.45} />
      {RIGHT_RIBBON_CORDS.map((cord) => (
        <g key={cord.id}>
          <path
            d={cord.d}
            fill="none"
            stroke={`url(#${cordGradId})`}
            strokeWidth={cord.width}
            strokeLinecap="round"
          />
          <path
            d={cord.d}
            fill="none"
            stroke={cordLight}
            strokeWidth={cord.highlightWidth}
            strokeOpacity={0.65}
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>,

    // 7. Apex Gathering Knot & Upward Whisk Spire
    <motion.g
      key="tome-ishi-apex-knot"
      data-tome-ishi-knot="collar-wrap"
      animate={cordPulseAnimation}
      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* 7A. Upward Spire / Whisk Ends */}
      <g data-tome-ishi-whisk="straw-spire">
        {STRAW_WHISK_STRANDS.map((strand) => (
          <g key={strand.id}>
            <path
              d={strand.d}
              fill="none"
              stroke={`url(#${cordGradId})`}
              strokeWidth={strand.width}
              strokeLinecap="round"
            />
            <path
              d={strand.d}
              fill="none"
              stroke={cordLight}
              strokeWidth={0.6}
              strokeOpacity={0.75}
              strokeLinecap="round"
            />
            <circle
              cx={strand.tipX}
              cy={strand.tipY}
              r={strand.width * 0.45}
              fill={cordLight}
              opacity={0.85}
            />
          </g>
        ))}
      </g>

      {/* 7B. Clean Structured Horizontal Coiled Collar Knot (슬림하고 차분하게 각진 수평 권선 매듭) */}
      {/* Base Shadow Under Knot */}
      <rect x="165" y="117" width="12" height="6.5" rx="0.6" fill="#1e1309" />
      {/* Knot Body */}
      <rect x="165" y="117" width="12" height="6.5" rx="0.6" fill={`url(#${knotGradId})`} stroke="#2d1c0e" strokeWidth="0.8" />
      {/* Crisp Horizontal Coiled Turns (3 compact winding cord ribs) */}
      <line x1="165.5" y1="118.8" x2="176.5" y2="118.8" stroke="#2d1c0e" strokeWidth="0.7" opacity="0.8" />
      <line x1="165.5" y1="120.5" x2="176.5" y2="120.5" stroke="#2d1c0e" strokeWidth="0.7" opacity="0.8" />
      <line x1="165.5" y1="122.2" x2="176.5" y2="122.2" stroke="#2d1c0e" strokeWidth="0.7" opacity="0.8" />
      {/* Top & Bottom Edge Bevel Glints */}
      <line x1="166" y1="117.5" x2="176" y2="117.5" stroke={cordLight} strokeWidth="0.5" strokeOpacity="0.6" />
    </motion.g>,
  ];

  return { nodes: sceneNodes, defs: [
          {
            tag: 'radialGradient',
            props: { id: stoneFillId, cx: '35%', cy: '28%', r: '75%' },
            children: [
              { tag: 'stop', props: { offset: '0%', stopColor: stoneLight } },
              { tag: 'stop', props: { offset: '38%', stopColor: stoneMid } },
              { tag: 'stop', props: { offset: '78%', stopColor: stoneBase } },
              { tag: 'stop', props: { offset: '100%', stopColor: stoneDark } },
            ],
          },
          {
            tag: 'linearGradient',
            props: { id: cordGradId, x1: '20%', y1: '0%', x2: '60%', y2: '100%' },
            children: [
              { tag: 'stop', props: { offset: '0%', stopColor: blendHex(cordLight, cordColor, 0.3) } },
              { tag: 'stop', props: { offset: '25%', stopColor: cordColor } },
              { tag: 'stop', props: { offset: '70%', stopColor: blendHex(cordColor, cordDark, 0.4) } },
              { tag: 'stop', props: { offset: '100%', stopColor: cordDark } },
            ],
          },
          {
            tag: 'linearGradient',
            props: { id: knotGradId, x1: '0%', y1: '0%', x2: '100%', y2: '0%' },
            children: [
              { tag: 'stop', props: { offset: '0%', stopColor: cordDark } },
              { tag: 'stop', props: { offset: '28%', stopColor: cordLight } },
              { tag: 'stop', props: { offset: '68%', stopColor: cordColor } },
              { tag: 'stop', props: { offset: '100%', stopColor: cordDark } },
            ],
          },
        ] };
}
