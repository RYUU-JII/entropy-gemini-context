import { DEFAULT_THEME_ID, assertCanonicalThemeId } from '../ids.js';

const DEFAULT_BOOT_THEME_ID = DEFAULT_THEME_ID;

export const THEME_BOOT_SCREEN_CSS = `
@keyframes themeBootStageRise {
  from { opacity: 0; transform: translateY(12px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes themeBootScanSweep {
  from { transform: translateY(-120%); }
  to { transform: translateY(120%); }
}

@keyframes themeBootPulse {
  0%, 100% { transform: scale(1); opacity: 0.88; }
  50% { transform: scale(1.025); opacity: 1; }
}

@keyframes themeBootGlyphFloat {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
}

@keyframes themeBootTrackDrift {
  from { background-position: 0 0; }
  to { background-position: 0 120px; }
}

@keyframes themeBootTrackSlideX {
  from { background-position: 0 0; }
  to { background-position: 120px 0; }
}

@keyframes themeBootDotBlink {
  0%, 80%, 100% { opacity: 0.18; transform: scale(0.72); }
  40% { opacity: 1; transform: scale(1); }
}

.theme-boot-screen {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  overflow: hidden;
  isolation: isolate;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 18%, var(--boot-glow), rgba(0, 0, 0, 0) 46%),
    linear-gradient(160deg, var(--boot-bg-a), var(--boot-bg-b));
  color: var(--boot-text);
}

.theme-boot-screen__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 12%, var(--boot-accent-soft), rgba(0, 0, 0, 0) 34%),
    radial-gradient(circle at 82% 82%, var(--boot-accent-2-soft), rgba(0, 0, 0, 0) 30%);
  opacity: 0.95;
}

.theme-boot-screen__grain {
  position: absolute;
  inset: -10%;
  opacity: var(--boot-grain-opacity);
  mix-blend-mode: soft-light;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.12'/%3E%3C/svg%3E");
}

.theme-boot-screen__scan {
  position: absolute;
  inset: -45% 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0),
    var(--boot-scan),
    rgba(0, 0, 0, 0)
  );
  opacity: 0.42;
  mix-blend-mode: screen;
  animation: themeBootScanSweep 3.1s linear infinite;
}

.theme-boot-screen__stage {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 32px;
  animation: themeBootStageRise 0.72s ease-out both;
}

.theme-boot-screen__eyebrow {
  font-family: var(--boot-mono-font);
  font-size: 11px;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: var(--boot-muted);
}

.theme-boot-screen__core {
  position: relative;
  width: var(--boot-core-width);
  height: var(--boot-core-height);
  display: block;
  overflow: hidden;
  isolation: isolate;
  border: 1px solid var(--boot-frame-line);
  box-shadow:
    0 0 0 1px var(--boot-frame-line-soft),
    0 22px 64px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  animation: themeBootPulse 2.8s ease-in-out infinite;
}

.theme-boot-screen__core::before,
.theme-boot-screen__core::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.theme-boot-screen__core::before {
  inset: 12px;
  border: 1px solid var(--boot-frame-line-soft);
}

.theme-boot-screen__core::after {
  inset: 28px;
  border: 1px dashed var(--boot-frame-line-soft);
  opacity: 0.82;
}

.theme-boot-screen__track {
  position: absolute;
  opacity: 0.86;
  filter: drop-shadow(0 0 10px var(--boot-glow-line));
}

.theme-boot-screen__glyph {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--boot-accent-strong);
  font-family: var(--boot-glyph-font);
  font-size: var(--boot-glyph-size);
  font-weight: 700;
  letter-spacing: var(--boot-glyph-spacing);
  text-transform: uppercase;
  text-shadow: 0 0 18px var(--boot-glow-line);
  animation: themeBootGlyphFloat 2.4s ease-in-out infinite;
  white-space: nowrap;
}

.theme-boot-screen__title {
  font-family: var(--boot-title-font);
  font-size: clamp(26px, 3vw, 40px);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--boot-text-strong);
}

.theme-boot-screen__subtitle {
  max-width: 560px;
  text-align: center;
  font-family: var(--boot-copy-font);
  font-size: 13px;
  line-height: 1.6;
  letter-spacing: 0.08em;
  color: var(--boot-muted);
  text-transform: uppercase;
}

.theme-boot-screen__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--boot-mono-font);
  font-size: 12px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--boot-text);
}

.theme-boot-screen__dots {
  display: inline-flex;
  gap: 4px;
}

.theme-boot-screen__dots span {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--boot-accent);
  animation: themeBootDotBlink 1.2s ease-in-out infinite;
}

.theme-boot-screen__dots span:nth-child(2) {
  animation-delay: 0.16s;
}

.theme-boot-screen__dots span:nth-child(3) {
  animation-delay: 0.32s;
}

.theme-boot-screen--zen .theme-boot-screen__core {
  border-radius: 999px;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0.06) 66%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(245, 239, 228, 0.12));
}

.theme-boot-screen--zen .theme-boot-screen__track {
  left: 17%;
  right: 17%;
  height: 1px;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0), var(--boot-frame-line), rgba(0, 0, 0, 0));
}

.theme-boot-screen--zen .theme-boot-screen__track--a { top: 37%; }
.theme-boot-screen--zen .theme-boot-screen__track--b { top: 50%; }
.theme-boot-screen--zen .theme-boot-screen__track--c { top: 63%; }

.theme-boot-screen--industrial .theme-boot-screen__core {
  border-radius: 26px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.08)),
    linear-gradient(160deg, rgba(28, 30, 34, 0.96), rgba(12, 14, 18, 0.96));
}

.theme-boot-screen--industrial .theme-boot-screen__core::before {
  inset: 16px;
  border-radius: 18px;
}

.theme-boot-screen--industrial .theme-boot-screen__core::after {
  inset: 34px 22px;
  border: 0;
  background:
    repeating-linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.06) 0 8px,
      rgba(0, 0, 0, 0) 8px 18px
    );
  opacity: 0.2;
}

.theme-boot-screen--industrial .theme-boot-screen__track {
  top: 26%;
  bottom: 26%;
  width: 18%;
  border-radius: 999px;
  background:
    linear-gradient(180deg, var(--boot-accent), rgba(0, 0, 0, 0)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.18));
}

.theme-boot-screen--industrial .theme-boot-screen__track--a { left: 16%; }
.theme-boot-screen--industrial .theme-boot-screen__track--b { left: 41%; }
.theme-boot-screen--industrial .theme-boot-screen__track--c { left: 66%; }

.theme-boot-screen--matrix .theme-boot-screen__core {
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.76), rgba(0, 10, 0, 0.94)),
    radial-gradient(circle at top center, rgba(0, 255, 65, 0.12), rgba(0, 0, 0, 0) 62%);
}

.theme-boot-screen--matrix .theme-boot-screen__core::after {
  inset: 18px;
  border: 0;
  background:
    repeating-linear-gradient(0deg, rgba(0, 255, 65, 0.06) 0 1px, rgba(0, 0, 0, 0) 1px 3px);
  opacity: 0.38;
}

.theme-boot-screen--matrix .theme-boot-screen__track {
  top: 16%;
  bottom: 16%;
  width: 20%;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0), var(--boot-accent), rgba(0, 0, 0, 0)),
    repeating-linear-gradient(180deg, rgba(0, 255, 65, 0.5) 0 6px, rgba(0, 0, 0, 0) 6px 18px);
  animation: themeBootTrackDrift 2.9s linear infinite;
}

.theme-boot-screen--matrix .theme-boot-screen__track--a { left: 14%; animation-delay: -0.4s; }
.theme-boot-screen--matrix .theme-boot-screen__track--b { left: 40%; animation-delay: -0.9s; }
.theme-boot-screen--matrix .theme-boot-screen__track--c { left: 66%; animation-delay: -1.4s; }

.theme-boot-screen--cyberpunk .theme-boot-screen__core {
  border-radius: 28px;
  transform: rotate(45deg);
  background:
    linear-gradient(180deg, rgba(7, 12, 28, 0.96), rgba(10, 14, 36, 0.94));
}

.theme-boot-screen--cyberpunk .theme-boot-screen__core::before {
  inset: 16px;
  border-radius: 22px;
  box-shadow: inset 0 0 24px rgba(0, 243, 255, 0.12);
}

.theme-boot-screen--cyberpunk .theme-boot-screen__track {
  left: 12%;
  right: 12%;
  height: 2px;
  transform: rotate(-32deg);
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0), var(--boot-accent), var(--boot-accent-2), rgba(0, 0, 0, 0));
  animation: themeBootTrackSlideX 2.2s linear infinite;
}

.theme-boot-screen--cyberpunk .theme-boot-screen__track--a { top: 34%; }
.theme-boot-screen--cyberpunk .theme-boot-screen__track--b { top: 50%; animation-delay: -0.7s; }
.theme-boot-screen--cyberpunk .theme-boot-screen__track--c { top: 66%; animation-delay: -1.4s; }

.theme-boot-screen--cyberpunk .theme-boot-screen__glyph {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.theme-boot-screen--clinical .theme-boot-screen__core {
  border-radius: 32px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(232, 237, 243, 0.96));
}

.theme-boot-screen--clinical .theme-boot-screen__core::after {
  inset: 26px 24px;
  border: 0;
  background:
    linear-gradient(90deg, rgba(15, 74, 125, 0.08) 1px, rgba(0, 0, 0, 0) 1px),
    linear-gradient(0deg, rgba(15, 74, 125, 0.08) 1px, rgba(0, 0, 0, 0) 1px);
  background-size: 18px 18px;
  opacity: 0.8;
}

.theme-boot-screen--clinical .theme-boot-screen__track {
  left: 14%;
  right: 14%;
  height: 2px;
  background:
    linear-gradient(90deg,
      rgba(0, 0, 0, 0) 0 10%,
      var(--boot-accent) 10% 18%,
      var(--boot-accent-2) 18% 40%,
      var(--boot-accent) 40% 52%,
      var(--boot-accent-2) 52% 76%,
      rgba(0, 0, 0, 0) 76% 100%);
}

.theme-boot-screen--clinical .theme-boot-screen__track--a { top: 38%; }
.theme-boot-screen--clinical .theme-boot-screen__track--b { top: 50%; opacity: 0.58; }
.theme-boot-screen--clinical .theme-boot-screen__track--c { top: 62%; opacity: 0.34; }

.theme-boot-screen--containment .theme-boot-screen__core {
  clip-path: polygon(18% 0%, 82% 0%, 100% 18%, 100% 82%, 82% 100%, 18% 100%, 0% 82%, 0% 18%);
  background:
    linear-gradient(180deg, rgba(10, 10, 10, 0.98), rgba(18, 18, 18, 0.98));
}

.theme-boot-screen--containment .theme-boot-screen__core::after {
  inset: 28px 18px;
  border: 0;
  background:
    repeating-linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.08) 0 10px,
      rgba(0, 0, 0, 0) 10px 24px
    );
  opacity: 0.2;
}

.theme-boot-screen--containment .theme-boot-screen__track {
  width: 2px;
  top: 18%;
  bottom: 18%;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0), var(--boot-accent), rgba(0, 0, 0, 0));
}

.theme-boot-screen--containment .theme-boot-screen__track--a { left: 32%; }
.theme-boot-screen--containment .theme-boot-screen__track--b { left: 50%; }
.theme-boot-screen--containment .theme-boot-screen__track--c { left: 68%; }
`;

const BOOT_PRESENTATION_OVERRIDES = Object.freeze({
  zen: Object.freeze({
    title: 'Zen',
    subtitle: 'A quiet place to grow your focus.',
    motif: 'zen',
    eyebrow: 'Ensō Threshold',
    glyph: 'ZEN',
    status: 'Drawing the quiet gate',
    coreWidth: '220px',
    coreHeight: '220px',
    glyphSize: '34px',
    glyphSpacing: '0.42em',
    titleFont: 'var(--font-sans)',
    monoFont: 'var(--font-mono)',
    copyFont: 'var(--font-sans)',
    glyphFont: 'var(--font-mono)',
    colors: Object.freeze({
      bgA: '#fdfbf7',
      bgB: '#efe7dc',
      accent: '#7d8e67',
      accentSecondary: '#d6b87a',
      accentStrong: '#4a4036',
      text: '#56483d',
      textStrong: '#3c332d',
      muted: 'rgba(86, 72, 61, 0.72)',
      frameLine: 'rgba(93, 64, 55, 0.28)',
      frameLineSoft: 'rgba(93, 64, 55, 0.14)',
      scan: 'rgba(125, 142, 103, 0.18)',
      glow: 'rgba(125, 142, 103, 0.18)',
      glowLine: 'rgba(125, 142, 103, 0.2)',
      accentSoft: 'rgba(125, 142, 103, 0.18)',
      accent2Soft: 'rgba(214, 184, 122, 0.16)',
      grainOpacity: '0.18',
    }),
  }),
  entropy: Object.freeze({
    title: 'PROJECT: ENTROPY',
    subtitle: 'Industrial Console // Nostromo Interface',
    motif: 'industrial',
    eyebrow: 'Control Deck',
    glyph: 'EN',
    status: 'Pressurizing control deck',
    coreWidth: '232px',
    coreHeight: '170px',
    glyphSize: '34px',
    glyphSpacing: '0.3em',
    titleFont: 'var(--font-sans)',
    monoFont: 'var(--font-mono)',
    copyFont: 'var(--font-sans)',
    glyphFont: 'var(--font-mono)',
    colors: Object.freeze({
      bgA: '#05070c',
      bgB: '#17110f',
      accent: '#ff6b2d',
      accentSecondary: '#ffd0b8',
      accentStrong: '#ffe3d4',
      text: '#ffd0b8',
      textStrong: '#fff0e7',
      muted: 'rgba(255, 208, 184, 0.74)',
      frameLine: 'rgba(255, 107, 45, 0.42)',
      frameLineSoft: 'rgba(255, 107, 45, 0.18)',
      scan: 'rgba(255, 107, 45, 0.18)',
      glow: 'rgba(255, 107, 45, 0.24)',
      glowLine: 'rgba(255, 107, 45, 0.28)',
      accentSoft: 'rgba(255, 107, 45, 0.18)',
      accent2Soft: 'rgba(255, 208, 184, 0.12)',
      grainOpacity: '0.2',
    }),
  }),
  cyberpunk: Object.freeze({
    title: 'PROJECT: CYBERPUNK',
    subtitle: 'Neon Grid // Independent Interface',
    motif: 'cyberpunk',
    eyebrow: 'Neon Relay',
    glyph: 'CP',
    status: 'Syncing neon relay grid',
    coreWidth: '198px',
    coreHeight: '198px',
    glyphSize: '30px',
    glyphSpacing: '0.24em',
    titleFont: '"Orbitron", "Rajdhani", var(--font-sans)',
    monoFont: '"Share Tech Mono", var(--font-mono)',
    copyFont: '"Rajdhani", var(--font-sans)',
    glyphFont: '"Orbitron", "Rajdhani", var(--font-sans)',
    colors: Object.freeze({
      bgA: '#030612',
      bgB: '#14091f',
      accent: '#00f3ff',
      accentSecondary: '#6a5cff',
      accentStrong: '#e9fdff',
      text: '#c8fbff',
      textStrong: '#f3feff',
      muted: 'rgba(200, 251, 255, 0.76)',
      frameLine: 'rgba(0, 243, 255, 0.44)',
      frameLineSoft: 'rgba(106, 92, 255, 0.2)',
      scan: 'rgba(0, 243, 255, 0.2)',
      glow: 'rgba(0, 243, 255, 0.26)',
      glowLine: 'rgba(0, 243, 255, 0.32)',
      accentSoft: 'rgba(0, 243, 255, 0.18)',
      accent2Soft: 'rgba(106, 92, 255, 0.18)',
      grainOpacity: '0.14',
    }),
  }),
  matrix: Object.freeze({
    title: 'PROJECT: MATRIX',
    subtitle: 'System Root // Digital Rain',
    motif: 'matrix',
    eyebrow: 'System Root',
    glyph: '01',
    status: 'Decrypting focus lattice',
    coreWidth: '252px',
    coreHeight: '158px',
    glyphSize: '50px',
    glyphSpacing: '0.18em',
    titleFont: '"VT323", var(--font-mono)',
    monoFont: '"Share Tech Mono", var(--font-mono)',
    copyFont: '"VT323", var(--font-mono)',
    glyphFont: '"VT323", var(--font-mono)',
    colors: Object.freeze({
      bgA: '#010401',
      bgB: '#031105',
      accent: '#00ff41',
      accentSecondary: '#66ff99',
      accentStrong: '#d8ffd8',
      text: '#a8ffb6',
      textStrong: '#e4ffe8',
      muted: 'rgba(168, 255, 182, 0.74)',
      frameLine: 'rgba(0, 255, 65, 0.38)',
      frameLineSoft: 'rgba(0, 143, 17, 0.24)',
      scan: 'rgba(0, 255, 65, 0.14)',
      glow: 'rgba(0, 255, 65, 0.18)',
      glowLine: 'rgba(0, 255, 65, 0.24)',
      accentSoft: 'rgba(0, 255, 65, 0.16)',
      accent2Soft: 'rgba(102, 255, 153, 0.12)',
      grainOpacity: '0.1',
    }),
  }),
  clinical: Object.freeze({
    title: 'Clinical Trial',
    subtitle: 'Immaculate, sterile, high-contrast.',
    motif: 'clinical',
    eyebrow: 'Sterile Array',
    glyph: 'CT',
    status: 'Running sterile calibration',
    coreWidth: '252px',
    coreHeight: '162px',
    glyphSize: '30px',
    glyphSpacing: '0.22em',
    titleFont: 'var(--font-sans)',
    monoFont: 'var(--font-mono)',
    copyFont: 'var(--font-sans)',
    glyphFont: 'var(--font-mono)',
    colors: Object.freeze({
      bgA: '#fbfcfe',
      bgB: '#e5edf4',
      accent: '#0f4a7d',
      accentSecondary: '#34c759',
      accentStrong: '#0d2b47',
      text: '#31506d',
      textStrong: '#162c40',
      muted: 'rgba(49, 80, 109, 0.72)',
      frameLine: 'rgba(15, 74, 125, 0.22)',
      frameLineSoft: 'rgba(15, 74, 125, 0.12)',
      scan: 'rgba(15, 74, 125, 0.1)',
      glow: 'rgba(15, 74, 125, 0.14)',
      glowLine: 'rgba(15, 74, 125, 0.18)',
      accentSoft: 'rgba(15, 74, 125, 0.12)',
      accent2Soft: 'rgba(52, 199, 89, 0.1)',
      grainOpacity: '0.08',
    }),
  }),
  scp: Object.freeze({
    title: 'SCP Foundation',
    subtitle: 'Secure. Contain. Protect. Administer anomalies with brutalist efficiency.',
    motif: 'containment',
    eyebrow: 'Containment',
    glyph: 'SCP',
    status: 'Verifying containment lattice',
    coreWidth: '216px',
    coreHeight: '216px',
    glyphSize: '28px',
    glyphSpacing: '0.16em',
    titleFont: '"Courier Prime", "JetBrains Mono", var(--font-mono)',
    monoFont: '"JetBrains Mono", var(--font-mono)',
    copyFont: '"Courier Prime", "JetBrains Mono", var(--font-mono)',
    glyphFont: '"JetBrains Mono", var(--font-mono)',
    colors: Object.freeze({
      bgA: '#050505',
      bgB: '#151515',
      accent: '#ff4040',
      accentSecondary: '#f2f2f2',
      accentStrong: '#ffffff',
      text: '#efefef',
      textStrong: '#ffffff',
      muted: 'rgba(239, 239, 239, 0.7)',
      frameLine: 'rgba(255, 64, 64, 0.34)',
      frameLineSoft: 'rgba(242, 242, 242, 0.14)',
      scan: 'rgba(255, 64, 64, 0.12)',
      glow: 'rgba(255, 64, 64, 0.16)',
      glowLine: 'rgba(255, 64, 64, 0.22)',
      accentSoft: 'rgba(255, 64, 64, 0.12)',
      accent2Soft: 'rgba(242, 242, 242, 0.1)',
      grainOpacity: '0.1',
    }),
  }),
});

function buildPresentation(themeId) {
  const override = BOOT_PRESENTATION_OVERRIDES[themeId];
  if (!override) {
    throw new Error(`[ThemeBootPresentation] Theme '${themeId}' has no boot presentation.`);
  }

  return Object.freeze({
    themeId,
    motif: override.motif,
    eyebrow: override.eyebrow,
    glyph: override.glyph,
    status: override.status,
    title: override.title,
    subtitle: override.subtitle,
    coreWidth: override.coreWidth,
    coreHeight: override.coreHeight,
    glyphSize: override.glyphSize,
    glyphSpacing: override.glyphSpacing,
    titleFont: override.titleFont,
    monoFont: override.monoFont,
    copyFont: override.copyFont,
    glyphFont: override.glyphFont,
    colors: override.colors,
  });
}

const THEME_BOOT_PRESENTATION_MAP = Object.freeze(
  Object.keys(BOOT_PRESENTATION_OVERRIDES).reduce((acc, themeId) => {
    acc[themeId] = buildPresentation(themeId);
    return acc;
  }, {}),
);

export function getThemeBootPresentation(themeId) {
  const resolvedThemeId = assertCanonicalThemeId(themeId, 'theme boot presentation');
  const presentation = THEME_BOOT_PRESENTATION_MAP[resolvedThemeId];
  if (!presentation) {
    throw new Error(`[ThemeBootPresentation] Theme '${resolvedThemeId}' has no boot presentation.`);
  }
  return presentation;
}

export function getThemeBootStyleVars(presentation) {
  const profile = presentation || getThemeBootPresentation(DEFAULT_BOOT_THEME_ID);
  const colors = profile.colors || {};

  return Object.freeze({
    '--boot-bg-a': colors.bgA,
    '--boot-bg-b': colors.bgB,
    '--boot-accent': colors.accent,
    '--boot-accent-2': colors.accentSecondary || colors.accent,
    '--boot-accent-strong': colors.accentStrong || colors.accent,
    '--boot-accent-soft': colors.accentSoft || colors.glow,
    '--boot-accent-2-soft': colors.accent2Soft || colors.accentSoft || colors.glow,
    '--boot-text': colors.text,
    '--boot-text-strong': colors.textStrong || colors.text,
    '--boot-muted': colors.muted || colors.text,
    '--boot-frame-line': colors.frameLine || colors.accent,
    '--boot-frame-line-soft': colors.frameLineSoft || colors.frameLine || colors.accent,
    '--boot-scan': colors.scan || colors.accentSoft || colors.glow,
    '--boot-glow': colors.glow || colors.accentSoft || colors.accent,
    '--boot-glow-line': colors.glowLine || colors.glow || colors.accent,
    '--boot-grain-opacity': colors.grainOpacity || '0.14',
    '--boot-core-width': profile.coreWidth || '220px',
    '--boot-core-height': profile.coreHeight || profile.coreWidth || '220px',
    '--boot-glyph-size': profile.glyphSize || '32px',
    '--boot-glyph-spacing': profile.glyphSpacing || '0.2em',
    '--boot-title-font': profile.titleFont || 'var(--font-sans)',
    '--boot-mono-font': profile.monoFont || 'var(--font-mono)',
    '--boot-copy-font': profile.copyFont || 'var(--font-sans)',
    '--boot-glyph-font': profile.glyphFont || profile.monoFont || 'var(--font-mono)',
  });
}

export function getThemeBootStyleText(presentation) {
  const vars = getThemeBootStyleVars(presentation);
  return Object.entries(vars).map(([key, value]) => `${key}:${value}`).join(';');
}
