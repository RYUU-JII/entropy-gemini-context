const THEME_ORNAMENTS = Object.freeze({
  entropy: `
    <div class="friction-gatekeeper-ornament friction-gatekeeper-ornament--entropy" aria-hidden="true">
      <span class="friction-gatekeeper-ornament__orb" style="--x: 16%; --hue: 210; --delay: 0.02s"></span>
      <span class="friction-gatekeeper-ornament__orb" style="--x: 38%; --hue: 265; --delay: 0.09s"></span>
      <span class="friction-gatekeeper-ornament__orb" style="--x: 56%; --hue: 190; --delay: 0.14s"></span>
      <span class="friction-gatekeeper-ornament__orb" style="--x: 72%; --hue: 245; --delay: 0.05s"></span>
    </div>
  `,
  matrix: `
    <div class="friction-gatekeeper-ornament friction-gatekeeper-ornament--matrix" aria-hidden="true">
      <span class="friction-gatekeeper-ornament__rain" style="--x: 18%; --delay: 0.05s; --dur: 1.2s"></span>
      <span class="friction-gatekeeper-ornament__rain" style="--x: 34%; --delay: 0.12s; --dur: 1.05s"></span>
      <span class="friction-gatekeeper-ornament__rain" style="--x: 52%; --delay: 0.02s; --dur: 1.35s"></span>
      <span class="friction-gatekeeper-ornament__rain" style="--x: 68%; --delay: 0.16s; --dur: 1.1s"></span>
      <span class="friction-gatekeeper-ornament__code-block">01 10 11 01</span>
      <span class="friction-gatekeeper-ornament__code-block">10 01 01 00</span>
    </div>
  `,
  clinical: `
    <div class="friction-gatekeeper-ornament friction-gatekeeper-ornament--clinical" aria-hidden="true">
      <span class="friction-gatekeeper-ornament__scanline friction-gatekeeper-ornament__scanline--top"></span>
      <span class="friction-gatekeeper-ornament__scanline friction-gatekeeper-ornament__scanline--mid"></span>
      <span class="friction-gatekeeper-ornament__scanline friction-gatekeeper-ornament__scanline--low"></span>
      <span class="friction-gatekeeper-ornament__node" style="--x: 22%; --y: 46%;"></span>
      <span class="friction-gatekeeper-ornament__node" style="--x: 45%; --y: 58%;"></span>
      <span class="friction-gatekeeper-ornament__node" style="--x: 68%; --y: 44%;"></span>
    </div>
  `,
  cyberpunk: `
    <div class="friction-gatekeeper-ornament friction-gatekeeper-ornament--cyberpunk" aria-hidden="true">
      <span class="friction-gatekeeper-ornament__arc"></span>
      <span class="friction-gatekeeper-ornament__arc friction-gatekeeper-ornament__arc--alt"></span>
      <span class="friction-gatekeeper-ornament__spark" style="--x: 28%; --delay: 0.06s"></span>
      <span class="friction-gatekeeper-ornament__spark" style="--x: 63%; --delay: 0.18s"></span>
      <span class="friction-gatekeeper-ornament__spark" style="--x: 82%; --delay: 0.11s"></span>
    </div>
  `,
  scp: `
    <div class="friction-gatekeeper-ornament friction-gatekeeper-ornament--scp" aria-hidden="true">
      <span class="friction-gatekeeper-ornament__cell"></span>
      <span class="friction-gatekeeper-ornament__cell" style="--x: 26%; --delay: 0.08s"></span>
      <span class="friction-gatekeeper-ornament__cell" style="--x: 56%; --delay: 0.03s"></span>
      <span class="friction-gatekeeper-ornament__cell" style="--x: 78%; --delay: 0.14s"></span>
      <span class="friction-gatekeeper-ornament__crack" style="--x: 36%; --y: 40%; --angle: -28deg"></span>
    </div>
  `,
});

const THEME_LOCK = Object.freeze(['entropy', 'matrix', 'clinical', 'cyberpunk', 'scp']);
const THEME_SET = new Set(THEME_LOCK);

function resolveThemeId(themeConfig = {}) {
  const themeId = String(themeConfig.themeId || '').trim();
  return THEME_SET.has(themeId) ? themeId : 'entropy';
}

export const defaultGatekeeperRenderer = Object.freeze({
  id: 'default_gatekeeper',
  getOrnamentMarkup({ themeConfig } = {}) {
    const themeId = resolveThemeId(themeConfig);
    return THEME_ORNAMENTS[themeId] || '';
  },
  onMount() {},
  onUnmount() {},
  onScrollGlow() {},
  onTug() {},
  onHoldProgress() {},
  getUnlockOverlayClass({ unlockPattern, themeConfig } = {}) {
    const normalized = String(unlockPattern || resolveThemeId(themeConfig) || '').toLowerCase();
    if (/^[1-3]$/.test(normalized)) {
      return `pattern-${normalized}`;
    }
    if (['entropy', 'matrix', 'clinical', 'cyberpunk', 'scp'].includes(normalized)) {
      return `pattern-${normalized}`;
    }
    return null;
  },
  getUnlockDurationMs() {
    return 300;
  },
});
