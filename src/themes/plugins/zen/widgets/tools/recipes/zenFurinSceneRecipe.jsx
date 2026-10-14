import { ZEN_FURIN_GEOMETRY as geometry } from './zenFurinGeometry.js';
import { ZEN_FURIN_PAPER_BOUNDS, ZEN_FURIN_PAPER_ROWS, projectZenFurinPaperBand } from './zenFurinPaper.js';
import React from 'react';
import { motion, useTransform } from 'framer-motion';
import { ARTIFACT_SVG_FILTER_REGIONS } from '../../../../../core/artifacts/scene/artifactSvgCoordinateSystem.js';
import {
  createArtifactSceneNode,
} from '../../../../../core/artifacts/scene/sceneGraph.js';

export const ZEN_FURIN_STAGE_WIDTH = geometry.width;
export const ZEN_FURIN_STAGE_HEIGHT = geometry.height;
export const ZEN_FURIN_PAPER_SHADOW = 'drop-shadow(0 12px 24px rgba(0,0,0,0.22))';

const SUPPORT_X = geometry.supportX;
const HANGER_Y = geometry.supportY;
const UPPER_CORD_HEIGHT = geometry.bellTop;
const BELL_LEFT = geometry.bellLeft;
const BELL_TOP = UPPER_CORD_HEIGHT;
const BELL_RIM_Y = geometry.bellRimY - BELL_TOP;
const STRIKER_TOP = geometry.strikerPivotY;
const STRIKER_CORD_HEIGHT = geometry.strikerLength - geometry.strikerRodLength;
const STRIKER_BODY_HEIGHT = geometry.strikerRodLength;
const STRIKER_TIP_Y = geometry.strikerLength;
const PAPER_HINGE_Y = geometry.strikerLength;
const PAPER_CORD_HEIGHT = geometry.paperCordLength;
const PAPER_WIDTH = geometry.paperWidth;
const PAPER_HEIGHT = geometry.paperHeight;
const PAPER_LEFT = -(PAPER_WIDTH / 2);
const PAPER_TOP = PAPER_CORD_HEIGHT;
const PAPER_ACCENT_HEIGHT = 4;
const PAPER_TEXT_START_Y = 18;
const PAPER_TEXT_GAP = 14;
const PARTICLE_ORIGIN_X = 150;
const PARTICLE_ORIGIN_Y = geometry.supportY + geometry.strikerPivotY + geometry.strikerLength + 120;
const KOI_X = 17;
const KOI_Y = 16;
const KOI_SCALE = 0.35;

export const ZEN_FURIN_SCENE_ANCHORS = Object.freeze({
  supportX: SUPPORT_X,
  hangerY: HANGER_Y,
  strikerTop: STRIKER_TOP,
  paperHingeY: PAPER_HINGE_Y,
});

// Narrow shoulders open into a lower, continuous belly. The shallow mouth
// reads nearly head-on while retaining the shared 40-unit contact boundary.
const BELL_BODY_PATH = `M38 0C25 0 18 3 15 10C11 19 8.5 32 10.5 42C12 50 14 55.4 18 ${BELL_RIM_Y}Q38 ${BELL_RIM_Y + (2 * geometry.bellRimDepth)} 58 ${BELL_RIM_Y}C62 55.4 64 50 65.5 42C67.5 32 65 19 61 10C58 3 51 0 38 0Z`;
const BELL_BACK_CONTOUR_PATH = 'M17 18C20 8 26 4 38 4C50 4 56 8 59 18C62.5 28 63.5 40 59 49';

function createStop(offset, stopColor, stopOpacity) {
  return createArtifactSceneNode('stop', {
    offset,
    stopColor,
    ...(stopOpacity === undefined ? {} : { stopOpacity }),
  });
}

function createFurinDefs(idScope, color) {
  return [
    ...ZEN_FURIN_PAPER_ROWS.slice(0, -1).map((y, index) =>
      createArtifactSceneNode('clipPath', { id: idScope.get(`paper-band-${index}`), clipPathUnits: 'userSpaceOnUse' }, [
        // Overlap opaque paper at subpixel clip edges; almost-touching clips
        // expose dark antialiasing seams on charcoal backgrounds.
        createArtifactSceneNode('rect', { x: ZEN_FURIN_PAPER_BOUNDS[0], y: y - 0.75,
          width: ZEN_FURIN_PAPER_BOUNDS[2], height: ZEN_FURIN_PAPER_ROWS[index + 1] - y + 1.5 }),
      ])),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('branch-grad'),
      x1: '0%',
      y1: '0',
      x2: '100%',
      y2: '100%',
    }, [
      createStop('0%', '#57534e'),
      createStop('45%', '#292524'),
      createStop('100%', '#0c0a09'),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('string-grad'),
      // A vertical line has a zero-width object bounding box. Its paint server
      // must use joint-local coordinates or the browser ignores the gradient.
      gradientUnits: 'userSpaceOnUse',
      x1: '0',
      y1: '0',
      x2: '0',
      y2: UPPER_CORD_HEIGHT,
    }, [
      createStop('0%', '#a8a29e', 0.9),
      createStop('100%', '#e7e5e4', 0.78),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('glass-striker'),
      x1: '0%', y1: '0%', x2: '0%', y2: '100%',
    }, [
      createStop('0%', '#ffffff', 1),
      createStop('70%', '#dcf5ff', 0.6),
      createStop('100%', '#c8e6ff', 0.2),
    ]),
    createArtifactSceneNode('radialGradient', {
      id: idScope.get('glass-reflect'),
      cx: '25%',
      cy: '20%',
      r: '70%',
    }, [
      createStop('0%', '#ffffff', 0.8),
      createStop('40%', '#ffffff', 0.1),
      createStop('100%', '#ffffff', 0),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('glass-volume'),
      x1: '0%',
      y1: '0%',
      x2: '0%',
      y2: '100%',
    }, [
      createStop('0%', color, 0.1),
      createStop('50%', color, 0),
      createStop('100%', color, 0.08),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('glass-rim'),
      x1: '0%',
      y1: '0%',
      x2: '100%',
      y2: '100%',
    }, [
      createStop('0%', '#ffffff', 0.85),
      createStop('30%', '#ffffff', 0.2),
      createStop('70%', '#ffffff', 0.1),
      createStop('100%', '#ffffff', 0.6),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('paper-grad'),
      x1: '0',
      y1: '0',
      x2: '0',
      y2: '1',
    }, [
      createStop('0%', '#ffffff'),
      createStop('100%', '#f5f5f4'),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('paper-back-grad'),
      x1: '0',
      y1: '0',
      x2: '0',
      y2: '1',
    }, [
      createStop('0%', '#faf8f5'),
      createStop('100%', '#ebe7df'),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('paper-sheen'),
      x1: '0',
      y1: '0',
      x2: '1',
      y2: '0',
    }, [
      createStop('0%', '#ffffff', 0.38),
      createStop('50%', '#ffffff', 0),
      createStop('100%', '#ffffff', 0.22),
    ]),
    createArtifactSceneNode('radialGradient', {
      id: idScope.get('pulse-ring-grad'),
      cx: '50%',
      cy: '50%',
      r: '50%',
    }, [
      createStop('0%', color, 0),
      createStop('54%', color, 0.62),
      createStop('75%', color, 0.18),
      createStop('100%', color, 0),
    ]),
    (
      <filter
        key="paper-grain"
        id={idScope.get('paper-grain')}
        {...ARTIFACT_SVG_FILTER_REGIONS.tightObjectBlur}
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence type="fractalNoise" baseFrequency="0.88" numOctaves="2" stitchTiles="stitch" result="noise" />
        <feColorMatrix
          in="noise"
          type="matrix"
          values="
            0 0 0 0 0.58
            0 0 0 0 0.56
            0 0 0 0 0.52
            0 0 0 0.28 0
          "
        />
      </filter>
    ),
  ];
}

function createBellBodyNodes(
  idScope,
  color,
  ambientVisualWeight,
  bellShimmer = 0,
) {
  return (
    <g key="furin-bell" transform={`translate(${BELL_LEFT} ${BELL_TOP})`}>
      <path
        d={BELL_BODY_PATH}
        fill={idScope.url('glass-volume')}
        stroke="none"
      />
      <path
        d={BELL_BODY_PATH}
        fill={idScope.url('glass-reflect')}
        stroke={idScope.url('glass-rim')}
        strokeWidth="1.2"
      />
      <path
        d={BELL_BODY_PATH}
        fill="none"
        stroke="rgba(15,23,42,0.14)"
        strokeWidth="0.75"
      />
      <motion.path data-zen-furin-shimmer="contour"
        d={BELL_BACK_CONTOUR_PATH}
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinejoin="round"
        style={{
          opacity: bellShimmer,
          filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 12px rgba(255,255,255,0.5))',
          mixBlendMode: 'screen',
        }}
      />
      <path d={BELL_BACK_CONTOUR_PATH} fill="none" stroke={color}
        strokeOpacity="0.12" strokeWidth="1.5" strokeLinejoin="round" />
      <ellipse cx={-BELL_LEFT} cy={BELL_RIM_Y}
        rx={geometry.bellInnerHalfWidth} ry={geometry.bellRimDepth}
        fill="rgba(15,23,42,0.035)" stroke={idScope.url('glass-rim')}
        strokeOpacity="0.55" strokeWidth="0.7" />
      <motion.ellipse data-zen-furin-shimmer="rim"
        cx={-BELL_LEFT}
        cy={BELL_RIM_Y}
        rx={geometry.bellInnerHalfWidth}
        ry={geometry.bellRimDepth}
        stroke={color}
        strokeWidth="1.2"
        fill="none"
        style={{
          opacity: bellShimmer,
          filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.7))',
          mixBlendMode: 'screen',
        }}
      />
      <g
        data-zen-furin-koi-coordinate-space="bell"
        transform={`translate(${KOI_X} ${KOI_Y}) scale(${KOI_SCALE})`}
        style={{ color }}
      >
        <motion.g
          data-zen-furin-koi-motion="local"
          style={{ opacity: 0.28 + (ambientVisualWeight * 0.42) }}
        >
          <path d="M 40 25 C 55 10 75 14 85 30 C 70 20 55 22 40 25 Z" fill="currentColor" opacity="0.5" />
          <path d="M 60 44 C 65 56 75 62 82 58 C 75 54 68 49 60 44 Z" fill="currentColor" opacity="0.6" />
          <path d="M 88 35 C 100 50 115 55 110 45 C 102 45 95 40 88 35 Z" fill="currentColor" opacity="0.6" />
          <path d="M 88 35 C 100 20 115 15 110 25 C 102 25 95 30 88 35 Z" fill="currentColor" opacity="0.6" />
          <path d="M 86 35 C 95 32 110 32 118 35 C 110 38 95 38 86 35 Z" fill="currentColor" opacity="0.8" />
          <path d="M 12 35 C 12 18 35 15 55 22 C 75 29 85 32 93 35 C 85 38 75 41 55 48 C 35 55 12 52 12 35 Z" fill="currentColor" />
          <path d="M 28 44 C 35 60 45 68 55 62 C 45 56 35 48 30 43 Z" fill="currentColor" opacity="0.7" />
          <path d="M 16 39 C 8 46 4 46 4 46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
          <path d="M 22 42 C 14 52 10 52 10 52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5" />
          <circle cx="23" cy="28" r="2" fill="#000000" opacity="0.4" />
        </motion.g>
      </g>
      <path
        d="M31 3C23 6 18 13 15 25C12 37 14 46 18 51C15 41 16 29 20 19C23 11 27 6 31 3Z"
        fill="#ffffff"
        opacity="0.12"
        style={{
          filter: 'blur(1px)',
          mixBlendMode: 'overlay',
        }}
      />
    </g>
  );
}

function FurinPaperBand({ idScope, sourceId, paperSkew, row }) {
  const transform = useTransform(() => projectZenFurinPaperBand(
    typeof paperSkew === 'number' ? paperSkew : paperSkew.get(), row,
  ));
  return <motion.g data-zen-furin-paper-band={row}
    style={{ transform, originX: 0, originY: 0, transformBox: 'view-box' }}>
    <g clipPath={idScope.url(`paper-band-${row}`)}><use href={`#${sourceId}`} /></g>
  </motion.g>;
}

function FurinPaperFace({ idScope, side, paperSkew, opacity, children }) {
  const sourceId = idScope.get(`paper-face-${side}`);
  return <motion.g style={{ opacity, filter: ZEN_FURIN_PAPER_SHADOW }}>
    <defs><g id={sourceId} data-zen-furin-paper-face-source={side}>{children}</g></defs>
    {ZEN_FURIN_PAPER_ROWS.slice(0, -1).map((_, row) =>
      <FurinPaperBand key={row} idScope={idScope} sourceId={sourceId} paperSkew={paperSkew} row={row} />)}
  </motion.g>;
}

function FurinTanzakuLeaf({
  idScope,
  color,
  mantraChars,
  paperYaw = 0,
  paperSkew = 0,
}) {
  const isMotionYaw = Boolean(paperYaw && typeof paperYaw === 'object' && typeof paperYaw.get === 'function');
  const paperScaleX = isMotionYaw
    ? useTransform(paperYaw, (v) => Math.cos(((Number(v) || 0) * Math.PI) / 180))
    : Math.cos(((Number(paperYaw) || 0) * Math.PI) / 180);
  const absScaleX = isMotionYaw
    ? useTransform(paperScaleX, (sx) => Math.max(0.04, Math.abs(sx)))
    : Math.max(0.04, Math.abs(paperScaleX));
  const frontOpacity = isMotionYaw
    ? useTransform(paperScaleX, (sx) => (sx >= 0 ? 1 : 0))
    : (paperScaleX >= 0 ? 1 : 0);
  const backOpacity = isMotionYaw
    ? useTransform(paperScaleX, (sx) => (sx < 0 ? 1 : 0))
    : (paperScaleX < 0 ? 1 : 0);

  return (
    <motion.g
      data-zen-furin-paper-leaf-motion="torsion"
      style={{
        scaleX: absScaleX,
        originX: `${PAPER_WIDTH / 2}px`,
        originY: 0,
        transformBox: 'view-box',
      }}
    >
      {/* Front Face: Authentic Calligraphy Mantra on Handmade Washi */}
      <FurinPaperFace idScope={idScope} side="front" paperSkew={paperSkew} opacity={frontOpacity}>
        <rect
          x="0"
          y="0"
          width={PAPER_WIDTH}
          height={PAPER_HEIGHT}
          fill={idScope.url('paper-grad')}
        />
        <rect
          x="0"
          y="0"
          width={PAPER_WIDTH}
          height={PAPER_HEIGHT}
          fill="#000000"
          opacity="0.16"
          filter={idScope.url('paper-grain')}
        />
        <rect x="0" y="0" width="1" height={PAPER_HEIGHT} fill="#000000" opacity="0.03" />
        <rect x={PAPER_WIDTH - 1} y="0" width="1" height={PAPER_HEIGHT} fill="#000000" opacity="0.03" />
        {mantraChars.map((char, index) => (
          <text
            key={`furin-mantra-front-${index}`}
            x={PAPER_WIDTH / 2}
            y={PAPER_TEXT_START_Y + (index * PAPER_TEXT_GAP)}
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="700"
          fontFamily="var(--font-theme-mono, monospace)"
            fill="rgba(68,64,60,0.92)"
            style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.08))' }}
          >
            {char}
          </text>
        ))}
        <rect
          x="0"
          y={PAPER_HEIGHT - PAPER_ACCENT_HEIGHT}
          width={PAPER_WIDTH}
          height={PAPER_ACCENT_HEIGHT}
          fill={color}
        />
        <rect
          x="0"
          y="0"
          width={PAPER_WIDTH}
          height={PAPER_HEIGHT}
          fill={idScope.url('paper-sheen')}
          opacity="0.22"
          style={{ mixBlendMode: 'overlay' }}
        />
      </FurinPaperFace>

      {/* Back Face: Translucent Washi with mirrored ink bleed-through */}
      <FurinPaperFace idScope={idScope} side="back" paperSkew={paperSkew} opacity={backOpacity}>
        <rect
          x="0"
          y="0"
          width={PAPER_WIDTH}
          height={PAPER_HEIGHT}
          fill={idScope.url('paper-back-grad')}
        />
        <rect
          x="0"
          y="0"
          width={PAPER_WIDTH}
          height={PAPER_HEIGHT}
          fill="#000000"
          opacity="0.22"
          filter={idScope.url('paper-grain')}
        />
        <rect x="0" y="0" width="1" height={PAPER_HEIGHT} fill="#000000" opacity="0.04" />
        <rect x={PAPER_WIDTH - 1} y="0" width="1" height={PAPER_HEIGHT} fill="#000000" opacity="0.04" />
        <g
          transform={`translate(${PAPER_WIDTH}, 0) scale(-1, 1)`}
          opacity="0.32"
          style={{ filter: 'blur(0.5px)' }}
        >
          {mantraChars.map((char, index) => (
            <text
              key={`furin-mantra-back-${index}`}
              x={PAPER_WIDTH / 2}
              y={PAPER_TEXT_START_Y + (index * PAPER_TEXT_GAP)}
              textAnchor="middle"
              fontSize="11.5"
              fontWeight="700"
              fontFamily="var(--font-theme-mono, monospace)"
              fill="rgba(68,64,60,0.85)"
            >
              {char}
            </text>
          ))}
        </g>
        <rect
          x="0"
          y={PAPER_HEIGHT - PAPER_ACCENT_HEIGHT}
          width={PAPER_WIDTH}
          height={PAPER_ACCENT_HEIGHT}
          fill={color}
          opacity="0.75"
        />
      </FurinPaperFace>
    </motion.g>
  );
}

function createLuminousCord(idScope, length, intensity, upper = false) {
  return <g opacity={intensity}>
    <line data-zen-furin-upper-cord={upper ? 'material' : undefined}
      x1="0" y1="0" x2="0" y2={length} stroke={idScope.url('string-grad')}
      strokeWidth={upper ? 1.15 : 0.85} strokeLinecap="round" />
  </g>;
}

function createPaperNodes({ idScope, color, mantra, paperRotation, paperYaw = 0, paperSkew = 0 }) {
  const mantraChars = Array.isArray(mantra) ? mantra : [];

  return (
    <g
      key="furin-paper-assembly"
      data-zen-furin-paper-coordinate-space="striker"
      transform={`translate(0 ${PAPER_HINGE_Y})`}
    >
      <motion.g
        data-zen-furin-paper-motion="local"
        style={{
          rotate: paperRotation,
          originX: 0, originY: 0,
          transformBox: 'view-box',
        }}
      >
        {createLuminousCord(idScope, PAPER_CORD_HEIGHT, 0.62)}
        <g transform={`translate(${PAPER_LEFT} ${PAPER_TOP})`}>
          <FurinTanzakuLeaf
            idScope={idScope}
            color={color}
            mantraChars={mantraChars}
            paperYaw={paperYaw}
            paperSkew={paperSkew}
          />
        </g>
      </motion.g>
    </g>
  );
}

function createParticleNodes({ color, isSimulationLive, shouldAnimateVisual, particleCount }) {
  if (!isSimulationLive || !shouldAnimateVisual || particleCount <= 0) {
    return [];
  }

  return Array.from({ length: particleCount }).map((_, index) => {
    const radius = ((index % 3) * 2) + 2;
    return (
      <motion.circle
        key={`furin-particle-${index}`}
        cx={PARTICLE_ORIGIN_X}
        cy={PARTICLE_ORIGIN_Y}
        r={radius / 2}
        fill={color}
        style={{
          filter: 'blur(1px)',
          mixBlendMode: 'screen',
        }}
        animate={{
          cy: [PARTICLE_ORIGIN_Y, PARTICLE_ORIGIN_Y + 180 + (index * 10)],
          cx: [PARTICLE_ORIGIN_X, PARTICLE_ORIGIN_X + ((index - 2.5) * 50)],
          opacity: [0, 0.22, 0],
          scale: [0.5, 1.2, 0],
        }}
        transition={{
          duration: 3.5 + (index % 2),
          repeat: Infinity,
          delay: index * 0.45,
          ease: 'easeInOut',
        }}
      />
    );
  });
}

export function buildZenFurinScene({
  idScope,
  color,
  mainRotation,
  strikerRotation,
  paperRotation,
  paperYaw = 0,
  paperSkew = 0,
  bellShimmer = 0,
  impactX = 0,
  impactScale = 0.35,
  impactOpacity = 0,
  mantra,
  shouldAnimateAmbientGlow,
  isSimulationLive,
  ambientVisualWeight,
  particleCount = 0,
  shouldAnimateVisual,
  settleTransitionDuration = 0.2,
  supportStyle = 'branch',
}) {
  if (!idScope) {
    throw new Error('[zenFurinSceneRecipe] buildZenFurinScene requires an id scope.');
  }
  if (!['branch', 'thread', 'lintel'].includes(supportStyle)) throw new Error('ZEN_FURIN_SUPPORT_STYLE_INVALID');

  const ambientGlowAnimate = shouldAnimateAmbientGlow
    ? {
      scale: [1, 1.08, 1],
      opacity: isSimulationLive ? [0.045, 0.06, 0.045] : [0.025, 0.035, 0.025],
    }
    : { scale: 1, opacity: 0.025 + (ambientVisualWeight * 0.02) };
  const ambientGlowTransition = shouldAnimateAmbientGlow
    ? { duration: isSimulationLive ? 6 : 8, repeat: Infinity, ease: 'easeInOut' }
    : { duration: settleTransitionDuration };

  return Object.freeze({
    defs: createFurinDefs(idScope, color),
    nodes: [
      (
        <motion.circle
          key="furin-ambient-glow"
          data-zen-furin-ambient-glow="material"
          initial={{ opacity: 0.045 }}
          cx={150}
          cy={geometry.supportY + geometry.bellCenterY}
          r={48}
          fill={color}
          style={{
            filter: 'blur(24px)',
            mixBlendMode: 'screen',
          }}
          animate={ambientGlowAnimate}
          transition={ambientGlowTransition}
        />
      ),
      supportStyle === 'thread' ? <g key="furin-support" data-zen-furin-support="thread" transform={`translate(${SUPPORT_X} ${HANGER_Y})`}>
        <line x1="0" y1="-1080" x2="0" y2="0" stroke="#c2bbae" strokeWidth="0.85" strokeOpacity="0.7" />
      </g> : supportStyle === 'lintel' ? <g key="furin-support" data-zen-furin-support="lintel" transform={`translate(${SUPPORT_X} ${HANGER_Y})`}>
        {/* The lintel itself is painted across the workspace by the gallery;
            the scene keeps only the cord's tie where it meets the beam. */}
        <ellipse cx="0" cy="-1" rx="3.2" ry="2.4" fill="#57534e" fillOpacity="0.85" />
      </g> : <g key="furin-support" data-zen-furin-support="branch" transform={`translate(${SUPPORT_X} ${HANGER_Y})`}>
        <rect x="-80" y="-8" width="160" height="8" rx="4"
          fill={idScope.url('branch-grad')} style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }} />
        <circle cx="0" cy="1" r="5" fill="#57534e" stroke="#a8a29e" strokeWidth="1" />
      </g>,
      (
        <g
          key="furin-hanger"
          data-zen-furin-hanger-coordinate-space="stage"
          transform={`translate(${SUPPORT_X} ${HANGER_Y})`}
        >
          <motion.g
            data-zen-furin-hanger-motion="local"
            style={{
              rotate: mainRotation,
              originX: 0, originY: 0,
          transformBox: 'view-box',
              filter: 'drop-shadow(0 12px 14px rgba(15,23,42,0.28))',
            }}
          >
            {createLuminousCord(idScope, UPPER_CORD_HEIGHT, 1, true)}
            {createBellBodyNodes(
              idScope,
              color,
              ambientVisualWeight,
              bellShimmer,
            )}
            <g
              data-zen-furin-striker-coordinate-space="hanger"
              transform={`translate(0 ${STRIKER_TOP})`}
            >
              <motion.g
                data-zen-furin-striker-motion="local"
                style={{
                  rotate: strikerRotation,
                  originX: 0, originY: 0,
          transformBox: 'view-box',
                }}
              >
                {createLuminousCord(idScope, STRIKER_CORD_HEIGHT, 0.55)}
                <rect
                  data-zen-furin-striker-rod="glass"
                  x={-geometry.strikerRodWidth / 2}
                  y={STRIKER_CORD_HEIGHT}
                  width={geometry.strikerRodWidth}
                  height={STRIKER_BODY_HEIGHT}
                  rx={geometry.strikerRodWidth / 2}
                  fill={idScope.url('glass-striker')}
                  opacity="0.88"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.55))' }}
                />
                {createPaperNodes({
                  idScope,
                  color,
                  mantra,
                  paperRotation,
                  paperYaw,
                  paperSkew,
                })}
                <circle cx="0" cy={STRIKER_TIP_Y} r="4" fill="#ffffff"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.9))' }} />
              </motion.g>
            </g>
            <path data-zen-furin-front-rim="glass"
              d={`M${-geometry.bellInnerHalfWidth} ${geometry.bellRimY}Q0 ${geometry.bellRimY + (2 * geometry.bellRimDepth)} ${geometry.bellInnerHalfWidth} ${geometry.bellRimY}`} fill="none"
              stroke={idScope.url('glass-rim')} strokeOpacity="0.85" strokeWidth="1" />
            <g data-zen-furin-impact-origin="rim" transform={`translate(0 ${geometry.bellRimY})`}>
              <motion.g data-zen-furin-impact-motion="contact"
                style={{ x: impactX, scale: impactScale, opacity: impactOpacity,
                  originX: 0, originY: 0, transformBox: 'view-box' }}>
                <circle cx="0" cy="0" r="24" fill={idScope.url('pulse-ring-grad')}
                  style={{ filter: 'blur(0.5px)' }} />
              </motion.g>
            </g>
          </motion.g>
        </g>
      ),
      ...createParticleNodes({ color, isSimulationLive, shouldAnimateVisual, particleCount }),
    ],
  });
}
