import { resolveSiteId } from '../targeting/siteIdentityCatalog.js';
import { removeAttribute, setAttribute } from '../visual/FastStyleEngine.js';

export const TEXT_SHUFFLE_PROJECTION_ATTRIBUTE = 'data-friction-shuffle-content';
const FONT_SIZE = '--friction-shuffle-font-size';
const LETTER_SPACING = '--friction-shuffle-letter-spacing';
const LINE_HEIGHT = '--friction-shuffle-line-height';
const MODE = 'data-friction-shuffle-presentation';
const TAIL = 'data-friction-shuffle-link-space';
const STYLE_ID = 'entropy-text-shuffle-projection';

// Instagram can hydrate a server-rendered row on interaction long after load.
// Keep its exact Text nodes; generated content owns only the visual reading run.
export function createTextShufflePresentation({
  getHostname = () => window.location.hostname,
  transformText,
} = {}) {
  const records = new WeakMap();
  let ownedStyle = null;

  function appliesTo() { return resolveSiteId(getHostname()) === 'instagram'; }
  function readingPlan(node) {
    const parent = node?.parentElement;
    if (!parent || node.nodeType !== Node.TEXT_NODE) return null;
    if (parent.childNodes.length === 1 && parent.firstChild === node) {
      return { parent, mode: 'leaf', prefix: [node], breaks: [], tails: [] };
    }
    // Caption prose and line breaks followed only by identity/tag links. Never
    // flatten a link or admit prose interleaved after an interactive child.
    if (typeof transformText !== 'function' || parent.firstChild !== node) return null;
    const prefix = []; const breaks = []; const tails = [];
    let link = null;
    for (const child of parent.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!link) prefix.push(child);
        else if (/^\s*$/.test(child.nodeValue)) {
          if (tails.at(-1)?.[0] === link) tails.at(-1)[1] += child.nodeValue;
          else tails.push([link, child.nodeValue]);
        }
        else return null;
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'BR' && !link) {
        prefix.push(child); breaks.push(child);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'A'
        && child.hasAttribute('href') && !child.querySelector('button, [role="button"], img, svg')) {
        link = child;
      } else return null;
    }
    return link ? { parent, mode: 'prefix', prefix, breaks, tails } : null;
  }
  function canPresent(node) {
    if (!appliesTo()) return true;
    return !!readingPlan(node);
  }
  function ensureStyle(doc) {
    if (ownedStyle?.isConnected) return;
    if (doc.getElementById(STYLE_ID)) throw new Error('TEXT_SHUFFLE_PROJECTION_STYLE_COLLISION');
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [${TEXT_SHUFFLE_PROJECTION_ATTRIBUTE}] { font-size: 0 !important; letter-spacing: 0 !important; }
      [${MODE}="leaf"]::after, [${MODE}="prefix"]::before, [${TAIL}]::after {
        all: unset !important;
      }
      [${MODE}="leaf"]::after, [${MODE}="prefix"]::before {
        content: attr(${TEXT_SHUFFLE_PROJECTION_ATTRIBUTE}) / "" !important;
        font-size: var(${FONT_SIZE}) !important;
        letter-spacing: var(${LETTER_SPACING}) !important;
        line-height: var(${LINE_HEIGHT}) !important;
      }
      [${MODE}="prefix"]::before { white-space: pre-wrap !important; }
      [${MODE}="prefix"] > br { display: none !important; }
      [${MODE}="prefix"] > a {
        font-size: var(${FONT_SIZE}) !important;
        letter-spacing: var(${LETTER_SPACING}) !important;
        line-height: var(${LINE_HEIGHT}) !important;
      }
      [${TAIL}]::after { content: attr(${TAIL}) / "" !important; white-space: pre-wrap !important; }
    `;
    doc.documentElement.appendChild(style);
    ownedStyle = style;
  }
  function release(node) {
    const record = records.get(node);
    if (!record) return;
    const { parent, properties, content, mode, tails } = record;
    if (parent.getAttribute(TEXT_SHUFFLE_PROJECTION_ATTRIBUTE) === content) {
      removeAttribute(parent, TEXT_SHUFFLE_PROJECTION_ATTRIBUTE);
    }
    if (parent.getAttribute(MODE) === mode) removeAttribute(parent, MODE);
    for (const [link, whitespace] of tails) {
      if (link.getAttribute(TAIL) === whitespace) removeAttribute(link, TAIL);
    }
    for (const [name, previous, priority, owned] of properties) {
      if (parent.style.getPropertyValue(name) !== owned) continue;
      if (previous) parent.style.setProperty(name, previous, priority);
      else parent.style.removeProperty(name);
    }
    records.delete(node);
  }
  function apply(node, original, shuffled) {
    const plan = readingPlan(node);
    if (!plan) throw new Error('TEXT_SHUFFLE_PROJECTION_READING_RUN_REQUIRED');
    release(node);
    const { parent, mode, prefix, tails } = plan;
    if (parent.hasAttribute(TEXT_SHUFFLE_PROJECTION_ATTRIBUTE) || parent.hasAttribute(MODE)
      || tails.some(([link]) => link.hasAttribute(TAIL))) {
      throw new Error('TEXT_SHUFFLE_PROJECTION_OWNER_COLLISION');
    }
    ensureStyle(parent.ownerDocument);
    const computed = parent.ownerDocument.defaultView.getComputedStyle(parent);
    const values = [[FONT_SIZE, computed.fontSize], [LETTER_SPACING, computed.letterSpacing],
      [LINE_HEIGHT, computed.lineHeight]];
    const properties = values.map(([name, owned]) => [name,
      parent.style.getPropertyValue(name), parent.style.getPropertyPriority(name), owned]);
    const source = prefix.map(part => part.nodeType === Node.TEXT_NODE ? part.nodeValue : '\n');
    const content = prefix.map((part, index) => part === node ? shuffled
      : part.nodeType === Node.TEXT_NODE ? transformText(source[index]) : '\n').join('');
    records.set(node, { parent, properties, content, mode, prefix, source, tails });
    for (const [name, , , owned] of properties) parent.style.setProperty(name, owned);
    for (const [link, whitespace] of tails) setAttribute(link, TAIL, whitespace);
    setAttribute(parent, MODE, mode);
    setAttribute(parent, TEXT_SHUFFLE_PROJECTION_ATTRIBUTE, content);
  }
  function isApplied(node, original, shuffled) {
    const record = records.get(node);
    const plan = readingPlan(node);
    return !!record && !!plan && record.parent === node.parentElement
      && node.nodeValue === original
      && plan.mode === record.mode && plan.prefix.length === record.prefix.length
      && plan.prefix.every((part, index) => part === record.prefix[index]
        && (part.nodeType !== Node.TEXT_NODE || part.nodeValue === record.source[index]))
      && plan.tails.length === record.tails.length
      && plan.tails.every(([link, whitespace], index) => record.tails[index][0] === link
        && record.tails[index][1] === whitespace && link.getAttribute(TAIL) === whitespace)
      && record.parent.getAttribute(MODE) === record.mode
      && record.parent.getAttribute(TEXT_SHUFFLE_PROJECTION_ATTRIBUTE) === record.content;
  }
  function dispose() { ownedStyle?.remove(); ownedStyle = null; }
  return Object.freeze({ appliesTo, canPresent, apply, isApplied, release, dispose,
    hasReadingPrefix: (node) => appliesTo() && readingPlan(node)?.mode === 'prefix',
  });
}
