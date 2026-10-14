import {
  getTextTargets,
  validateTextTargets,
} from '../text/textTargetProfiles.js';
import { recordProtectionFeatureError } from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import { setText } from './FastStyleEngine.js';

const STYLE_ID = 'friction-global-style';
const TEXT_STYLE_ID = 'friction-text-target-style';
const EMPTY_SELECTOR = ':where([data-friction-empty-text-target="1"])';
const MAX_VALIDATED_TEXT_SELECTOR_SIGNATURES = 32;
const validatedTextSelectorSignatures = new Set();

const GLOBAL_FRICTION_CSS = `
:root {
  --f-blur: 0px;
  --f-saturation: 1;
  --f-brightness: 1;
  --f-contrast: 1;
  --f-color-saturation: 1;
  --f-media-filter: none;
  --f-text-blur: 0px;
  --f-text-shadow: none;
  --f-text-opacity: 1;
}

/* Root grayscale is applied inline by VisualManager so the page's
   existing root filter chain can be merged and restored safely. */

/* Media filters use additive Web Animation effects so host filter chains stay untouched. */

html[data-friction-input-delay-active="1"] [data-friction-input-delay="1"] {
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  text-shadow: none !important;
  caret-color: transparent !important;
}

html[data-friction-input-delay-active="1"] [data-friction-input-delay="1"]::selection {
  background-color: transparent !important;
  color: transparent !important;
}

html[data-friction-input-delay-active="1"] [data-friction-input-delay="1"]::placeholder {
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  opacity: 0 !important;
}

html[data-friction-input-visual-brake-active="1"] [data-friction-input-visual-brake="1"] {
  transition: caret-color 160ms ease !important;
}

.friction-input-ink-overlay {
  contain: layout paint style;
  isolation: isolate;
  pointer-events: none !important;
  background: transparent;
}

.friction-input-ink-overlay[data-friction-input-ink-sensitive="1"] {
  background: transparent;
}

.friction-input-ink-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  transform: translateZ(0);
  image-rendering: auto;
}

.friction-input-ink-overlay[data-friction-input-ink-sensitive="1"] .friction-input-ink-canvas {
  filter: saturate(0.72);
  opacity: 0.92;
}

@keyframes frictionCaretBlink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.friction-input-overlay__caret {
  display: inline-block;
  width: 1px;
  min-width: 1px;
  max-width: 1px;
  flex: 0 0 1px;
  height: 1em;
  background: var(--friction-overlay-caret, currentColor);
  animation: frictionCaretBlink 1s steps(1) infinite;
  vertical-align: baseline;
}

html[data-friction-social-metrics="1"] [data-friction-social-engagement="1"],
html[data-friction-social-metrics="1"] [data-friction-social-exposure="1"] {
  visibility: hidden !important;
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  text-shadow: none !important;
  pointer-events: none !important;
  user-select: none !important;
}

html[data-friction-social-metrics="1"] [data-friction-social-tiktok-collapse="1"] {
  display: none !important;
}

html[data-friction-social-metrics="1"] [data-friction-social-instagram-collapse="1"] {
  display: none !important;
}

html[data-friction-social-metrics="1"] :is(
  like-button-view-model,
  #top-level-buttons-computed
) :is(
  #vote-count-middle,
  .yt-spec-button-shape-next__button-text-content,
  .ytSpecButtonShapeNextButtonTextContent
)[data-friction-social-engagement="1"] {
  display: none !important;
}

html[data-friction-social-metrics="1"] like-button-view-model button:has(
  :is(
    .yt-spec-button-shape-next__button-text-content,
    .ytSpecButtonShapeNextButtonTextContent
  )[data-friction-social-engagement="1"]
) {
  min-width: 0 !important;
  width: auto !important;
  gap: 0 !important;
}

html[data-friction-shortform-block="1"] [data-friction-shortform-hidden="1"]:not([data-friction-shortform-collapsed="1"]) {
  display: none !important;
}

html[data-friction-shortform-block="1"] [data-friction-shortform-hidden="1"][data-friction-shortform-collapsed="1"] {
  box-sizing: border-box !important;
  height: 1px !important;
  min-height: 1px !important;
  max-height: 1px !important;
  margin-block: 0 !important;
  padding-block: 0 !important;
  border-block-width: 0 !important;
  overflow: hidden !important;
  flex-shrink: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
  user-select: none !important;
}

html[data-friction-shortform-block="1"] [data-friction-shortform-hidden="1"][data-friction-shortform-collapsed="1"] > * {
  box-sizing: border-box !important;
  height: 1px !important;
  min-height: 0 !important;
  max-height: 1px !important;
  margin-block: 0 !important;
  padding-block: 0 !important;
  border-block-width: 0 !important;
  overflow: hidden !important;
}
`.trim();

function ensureStyle(id) {
  if (typeof document === 'undefined') return null;
  const existing = document.getElementById(id);
  if (existing) return existing;

  const style = document.createElement('style');
  style.id = id;
  const target = document.head || document.documentElement;
  target.appendChild(style);
  return style;
}

function normalizeSelector(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateTextTargetSelector(selector, field) {
  const normalized = normalizeSelector(selector);
  if (!normalized || typeof document === 'undefined') return;
  try {
    document.createDocumentFragment().querySelector(normalized);
  } catch (error) {
    const wrapped = new Error(`TEXT_TARGET_SELECTOR_INVALID:${field}`, { cause: error });
    recordProtectionFeatureError('textPipeline', wrapped, {
      phase: 'text_target_selector_compile',
      field,
      selector: normalized,
      error: String(error?.message || error),
    });
    console.warn?.('[TextPipeline] selector compilation failed', {
      field,
      selector: normalized,
      error: String(error?.message || error),
    });
    throw wrapped;
  }
}

function validateTextTargetSelectorsOnce(entries) {
  const signature = JSON.stringify(entries.map(([field, selector]) => [field, normalizeSelector(selector)]));
  if (validatedTextSelectorSignatures.has(signature)) return;
  entries.forEach(([field, selector]) => validateTextTargetSelector(selector, field));
  if (validatedTextSelectorSignatures.size >= MAX_VALIDATED_TEXT_SELECTOR_SIGNATURES) {
    const oldest = validatedTextSelectorSignatures.values().next().value;
    validatedTextSelectorSignatures.delete(oldest);
  }
  validatedTextSelectorSignatures.add(signature);
}

function buildOverlayExclusionSelector(overlayExemptSelector) {
  const normalized = normalizeSelector(overlayExemptSelector);
  if (!normalized) return '';
  return `:not(:is(${normalized}), :is(${normalized}) *)`;
}

function buildScopedTopLevelTextSelector(selector, overlayExemptSelector) {
  const normalized = normalizeSelector(selector);
  if (!normalized) return EMPTY_SELECTOR;
  return `:where(${normalized}):not(:where(${normalized}) :where(${normalized}))${buildOverlayExclusionSelector(overlayExemptSelector)}`;
}

function buildTextTargetCss({
  layoutSelector = EMPTY_SELECTOR,
  effectSelector = EMPTY_SELECTOR,
  shuffleSelector = EMPTY_SELECTOR,
} = {}) {
  return `
html[data-friction-text-rhythm="1"] ${layoutSelector} {
  filter: blur(var(--f-text-blur)) !important;
  opacity: var(--f-text-opacity) !important;
  transition: filter 0.15s ease, opacity 0.15s ease;
}

html[data-friction-text-shadow="1"] ${effectSelector} {
  text-shadow: var(--f-text-shadow) !important;
  transition: text-shadow 0.15s ease;
}

html[data-friction-text-shuffle-pending="1"] ${shuffleSelector} {
  visibility: hidden !important;
}

html[data-friction-text-shuffle-debug="1"] [data-friction-shuffled="1"] {
  outline: 1px dashed #ff4d6d !important;
  background-color: rgba(255, 215, 64, 0.22) !important;
  box-shadow: inset 0 -2px 0 #00d5ff !important;
}

html[data-friction-text-shuffle-debug="1"] [data-friction-shuffled="1"]::before {
  content: "SHUF";
  display: inline-block;
  margin-right: 0.35em;
  padding: 0.05em 0.3em;
  border: 1px solid #ff4d6d;
  background: #ffd740;
  color: #111111;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  vertical-align: 0.08em;
}
  `.trim();
}

let lastTextSelectorSignature = '';

export function ensureFrictionGlobalStyles() {
  const style = ensureStyle(STYLE_ID);
  if (!style) return;
  if (style.textContent === GLOBAL_FRICTION_CSS) return;
  setText(style, GLOBAL_FRICTION_CSS);
}

export function syncFrictionTextTargetStyles(targets) {
  const {
    textLayoutTargets,
    textEffectTargets,
    textShuffleTargets,
    overlayExempt,
  } = validateTextTargets(targets);
  ensureFrictionGlobalStyles();
  const style = ensureStyle(TEXT_STYLE_ID);
  if (!style) return;

  validateTextTargetSelectorsOnce([
    ['textLayoutTargets', textLayoutTargets],
    ['textEffectTargets', textEffectTargets],
    ['textShuffleTargets', textShuffleTargets],
    ['overlayExempt', overlayExempt],
  ]);

  const layoutSelector = buildScopedTopLevelTextSelector(textLayoutTargets, overlayExempt);
  const effectSelector = buildScopedTopLevelTextSelector(textEffectTargets, overlayExempt);
  const shuffleSelector = buildScopedTopLevelTextSelector(textShuffleTargets, overlayExempt);
  const nextSignature = JSON.stringify([layoutSelector, effectSelector, shuffleSelector]);
  const nextCss = buildTextTargetCss({
    layoutSelector,
    effectSelector,
    shuffleSelector,
  });
  if (nextSignature === lastTextSelectorSignature && style.textContent === nextCss) return;

  setText(style, nextCss);
  lastTextSelectorSignature = nextSignature;
}

export function syncFrictionTextTargetStylesForHostname(hostname) {
  const selectors = getTextTargets(hostname);
  syncFrictionTextTargetStyles(selectors);
  return selectors;
}
