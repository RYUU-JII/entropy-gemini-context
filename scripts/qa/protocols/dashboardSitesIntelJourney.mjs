import { evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { SITE_INTEL_CAPTURE_CASES, SITE_INTEL_INTERPRETATION_CAPTURE_CASE_IDS, buildSiteIntelCaptureFixture } from '../../../src/apps/dashboard/qa/siteIntelCaptureFixtures.dev.js';

// The Zen notebook is a bounded canvas. A control or text fragment is usable
// only when its complete bounds fit without scrolling any document/body owner.
export function inspectZenNotebookAccess() {
  const panel = document.querySelector('#sites-site-detail');
  if (panel?.dataset.variant !== 'zen') return null;
  const viewport = { width: innerWidth, height: innerHeight };
  const notebook = document.querySelector('[data-sites-fit="notebook"]');
  const main = panel.querySelector('.zen-site-usage');
  const body = main?.querySelector('.zen-site-ledger__viewport[data-view]');
  if (!main || !body) throw new Error('QA_ZEN_SITE_LEDGER_REQUIRED');
  const foreground = document.querySelector('.zen-home-garden-occlusion > div:last-child');
  let footing = null;
  if (foreground) {
    const clip = getComputedStyle(foreground).clipPath;
    if (!clip.startsWith('polygon(') || !clip.endsWith(')')) throw new Error('QA_ZEN_FOOTING_POLYGON_REQUIRED');
    const points = clip.slice(8, -1).split(',').map(pair => {
      const match = pair.trim().match(/^(-?[\d.]+)px\s+(-?[\d.]+)px$/u);
      if (!match || !Number.isFinite(Number(match[1])) || !Number.isFinite(Number(match[2]))) throw new Error('QA_ZEN_FOOTING_POLYGON_INVALID');
      return {x:Number(match[1]),y:Number(match[2])};
    });
    if (points.length < 3) throw new Error('QA_ZEN_FOOTING_POLYGON_INVALID');
    const origin = foreground.getBoundingClientRect();
    footing = {left:origin.left + Math.min(...points.map(point => point.x)),
      right:origin.left + Math.max(...points.map(point => point.x)),
      top:origin.top + Math.min(...points.map(point => point.y)),
      bottom:origin.top + Math.max(...points.map(point => point.y))};
  }
  const coveredByFooting = rect => footing !== null && rect.right > footing.left
    && rect.left < footing.right && rect.bottom > footing.top && rect.top < footing.bottom;
  const inspect = node => {
    if (!node) return { visible: false, reachable: false, clippedBy: [] };
    const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
    const visible = node.getClientRects().length > 0 && rect.width > 0 && rect.height > 0
      && style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0
      && !node.closest('[hidden], [inert]');
    const clippedBy = [];
    for (let owner = node.parentElement; owner; owner = owner.parentElement) {
      const css = getComputedStyle(owner), bounds = owner.getBoundingClientRect();
      const left = bounds.left + owner.clientLeft, top = bounds.top + owner.clientTop;
      if ((['auto', 'scroll', 'hidden', 'clip'].includes(css.overflowX)
        && (rect.left < left - 1 || rect.right > left + owner.clientWidth + 1))
        || (['auto', 'scroll', 'hidden', 'clip'].includes(css.overflowY)
          && (rect.top < top - 1 || rect.bottom > top + owner.clientHeight + 1))) {
        clippedBy.push({ tag: owner.tagName, id: owner.id, classes: owner.getAttribute('class') });
      }
    }
    const clippedContent = (['hidden', 'clip'].includes(style.overflowY) && node.scrollHeight > node.clientHeight + 1)
      || (['hidden', 'clip'].includes(style.overflowX) && node.scrollWidth > node.clientWidth + 1);
    const occluded = node.matches('button, input, summary, h2') && coveredByFooting(rect);
    return { visible, reachable: visible && !occluded && rect.left >= -1 && rect.right <= viewport.width + 1
      && rect.top >= -1 && rect.bottom <= viewport.height + 1
      && clippedBy.length === 0 && !clippedContent, clippedBy, clippedContent, occluded,
      withinViewport: rect.top >= -1 && rect.bottom <= viewport.height + 1,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } };
  };
  const containers = new Map([
    ['document', document.scrollingElement], ['sites-tab', document.querySelector('#sites-tab')],
    ['notebook', notebook], ['workspace', document.querySelector('.sites-sites-workspace')],
    ['selected', document.querySelector('.sites-sites-workspace__selected')], ['detail', panel], ['reading', main], ['body', body],
  ]);
  for (let owner = panel.parentElement; owner; owner = owner.parentElement) {
    if (!Array.from(containers.values()).includes(owner)) containers.set('ancestor-' + containers.size, owner);
  }
  const scroll = Array.from(containers, ([name, node]) => {
    if (!node) return { name, missing: true };
    const style = getComputedStyle(node);
    // Garden's non-scrolling paint owners carry the declared one-pixel canvas
    // bleed. Check its actual fractional extent, not a wider notebook tolerance.
    // Reachability below still inspects every clipping ancestor and control.
    const framePaintOwner = node.matches('.zen-home-frame, .zen-home-stage');
    const paintBleed = framePaintOwner
      ? Number.parseFloat(style.getPropertyValue('--zen-home-frame-paint-bleed')) : 0;
    if (framePaintOwner && (!Number.isFinite(paintBleed) || paintBleed < 0 || paintBleed > 1)) {
      throw new Error('QA_ZEN_NOTEBOOK_FRAME_PAINT_BLEED_INVALID');
    }
    return {
      name, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop,
      clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, scrollLeft: node.scrollLeft,
      overflowY: style.overflowY,
      maxScrollHeight: framePaintOwner ? Math.ceil(node.getBoundingClientRect().height + paintBleed) : node.clientHeight + 1,
      maxScrollWidth: framePaintOwner ? Math.ceil(node.getBoundingClientRect().width + paintBleed) : node.clientWidth + 1,
    };
  });
  const controls = [
    ['ledger-return', document.querySelector('.sites-notebook-heading__back')],
    ['site-identity', document.querySelector('.sites-notebook-heading__identity h2')],
    ['management', document.querySelector('.zen-record-management > summary')],
    ['management-surface', document.querySelector('.zen-record-management[open] .sites-notebook-heading__controls')],
    ...Array.from(document.querySelectorAll('.zen-record-management[open] button, .zen-record-management[open] input'))
      .filter(node => inspect(node).visible).map((node, index) => ['management-control-' + index, node]),
    ['site-cap', panel.querySelector('[data-site-cap]')],
    ['site-cap-edit', panel.querySelector('[data-site-cap] .sites-cap-readout__value, [data-site-cap] .sites-cap-inline-editor input')],
    ['body', body],
    ...Array.from(main.querySelectorAll('button, input, [tabindex="-1"][aria-label]'))
      .filter(node => inspect(node).visible && !node.closest('[data-ledger-measure="true"]'))
      .map((node, index) => ['ledger-control-' + index, node]),
  ];
  const measured = controls.filter(([, node]) => node !== null && !node.closest('[hidden], [inert], [aria-hidden="true"]'))
    .map(([name, node]) => ({ name, ...inspect(node) }));
  const failedControls = measured.filter(item => !item.reachable);
  const failedScroll = scroll.filter(item => item.missing || item.clientWidth <= 0
    || item.scrollWidth > item.maxScrollWidth || Math.abs(item.scrollLeft) > 1
    || item.scrollHeight > item.maxScrollHeight || Math.abs(item.scrollTop) > 1);
  const textFailures = [];
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode, owner = text.parentElement;
    if (!text.textContent.trim() || !owner || !inspect(owner).visible
      || owner.closest('svg, [data-ledger-measure="true"]')) continue;
    const accessibleLabel = owner.closest('.sr-only');
    if (accessibleLabel) {
      const css = getComputedStyle(accessibleLabel), bounds = accessibleLabel.getBoundingClientRect();
      // Intentional assistive-only labels have a clipped one-pixel box. Keep
      // measuring any normally painted text, even if it retains this class.
      if (bounds.width <= 1 && bounds.height <= 1 && css.overflow === 'hidden'
        && (css.clip !== 'auto' || css.clipPath !== 'none')) continue;
    }
    const range = document.createRange(); range.selectNodeContents(text);
    for (const rect of range.getClientRects()) {
      let clipped = coveredByFooting(rect) || rect.left < -1 || rect.right > viewport.width + 1 || rect.top < -1 || rect.bottom > viewport.height + 1;
      for (let ancestor = owner; ancestor && !clipped; ancestor = ancestor.parentElement) {
        const css = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
        const left = bounds.left + ancestor.clientLeft, top = bounds.top + ancestor.clientTop;
        clipped = (['auto', 'scroll', 'hidden', 'clip'].includes(css.overflowX)
          && (rect.left < left - 1 || rect.right > left + ancestor.clientWidth + 1))
          || (['auto', 'scroll', 'hidden', 'clip'].includes(css.overflowY)
            && (rect.top < top - 1 || rect.bottom > top + ancestor.clientHeight + 1));
      }
      if (clipped) textFailures.push({ text: text.textContent.trim().slice(0, 160),
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } });
    }
  }
  const nestedScroll = Array.from(main.querySelectorAll('*')).filter(node => inspect(node).visible
    && !node.closest('[data-ledger-measure="true"]') && ['auto', 'scroll'].includes(getComputedStyle(node).overflowY)
    && node.scrollHeight > node.clientHeight + 1).map(node => ({ tag: node.tagName, role: node.getAttribute('role') }));
  const noDialog = !document.querySelector('[role="dialog"], [aria-modal="true"]');
  return { viewport, mode: document.querySelector('.sites-sites-workspace')?.dataset.mode,
    notebook: inspect(notebook), body: inspect(body), view: body.dataset.view, scroll, noDialog, footing,
    requiredControlCount: measured.length, verifiedControlCount: measured.length - failedControls.length,
    failedControlCount: failedControls.length, failedControls: failedControls.slice(0, 12),
    failedScrollCount: failedScroll.length,
    failedTextCount: textFailures.length, failedText: textFailures.slice(0, 12), nestedScroll,
    accessible: Boolean(notebook && inspect(notebook).reachable && noDialog && !failedControls.length
      && !failedScroll.length && !textFailures.length && !nestedScroll.length) };
}

async function requireZenNotebookAccess({ harness, page, phase }) {
  const access = await evaluate(harness.cdp, page.sessionId, '(' + inspectZenNotebookAccess.toString() + ')()');
  if (access && (access.mode !== 'notebook' || !access.accessible)) {
    const error = new Error('QA_ZEN_SITE_NOTEBOOK_NOT_ACCESSIBLE:' + phase); error.diagnostic = access; throw error;
  }
  return access;
}

async function settleReading(harness, page) {
  await evaluate(harness.cdp, page.sessionId, '(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); })()');
}

export function inspectZenLedger() {
  const panel = document.querySelector('#sites-site-detail');
  const viewport = panel?.querySelector('.zen-site-ledger__viewport[data-view]');
  const visible = node => Boolean(node?.getClientRects().length
    && !node.closest('[hidden], [inert], [aria-hidden="true"], [data-ledger-measure="true"]'));
  const annotations = Array.from(panel?.querySelectorAll('[data-ledger-state]') || []).find(visible);
  const field = Array.from(panel?.querySelectorAll('.zen-site-ledger-field[role="group"]') || []).find(visible);
  const pager = Array.from(viewport?.querySelectorAll('.zen-ledger-pages[data-page-index][data-page-count]') || []).find(visible);
  return {
    id: panel?.querySelector('[data-intel-capture-case]')?.dataset.intelCaptureCase,
    state: annotations?.dataset.ledgerState,
    start: annotations?.dataset.periodStart, end: annotations?.dataset.periodEnd,
    mode: document.querySelector('.sites-sites-workspace')?.dataset.mode,
    view: viewport?.dataset.view, visible: visible(viewport),
    focus: viewport?.dataset.focusKind ? { kind: viewport.dataset.focusKind, id: viewport.dataset.focusId } : null,
    selectedDate: viewport?.dataset.selectedDate,
    dayView: viewport?.dataset.dayView, selectedHour: viewport ? Number(viewport.dataset.selectedHour) : null,
    dayAnchor: viewport?.dataset.dayAnchor, fieldAnchor: viewport?.dataset.fieldAnchor,
    annotationAnchor: viewport?.dataset.annotationAnchor,
    context: field?.querySelector('[data-ledger-context]')?.textContent.trim(),
    backCount: Array.from(document.querySelectorAll('[data-ledger-action="back"], [data-workspace-action="back"]')).filter(visible).length,
    overviewJumpCount: Array.from(panel?.querySelectorAll('[data-ledger-action="overview"], [data-ledger-action="close-slip"]') || []).filter(visible).length,
    pageIndex: pager ? Number(pager.dataset.pageIndex) : null,
    pageCount: pager ? Number(pager.dataset.pageCount) : null,
    groupNamed: Boolean(field && document.getElementById(field.getAttribute('aria-labelledby'))?.textContent),
    alert: panel?.querySelector('[role="alert"]')?.textContent,
    todayBasis: panel?.querySelector('[data-time-kind="today"]')?.dataset.usageBasis,
    todayVisible: visible(panel?.querySelector('[data-time-kind="today"]')),
    averageRows: field?.querySelectorAll('[data-kind="average"]').length,
    annotations: Array.from(annotations?.querySelectorAll('button[data-annotation-id]') || []).filter(visible).map(node => ({
      kind: node.dataset.annotationKind, id: node.dataset.annotationId, pressed: node.getAttribute('aria-pressed'),
      controlledRegion: Boolean(document.getElementById(node.getAttribute('aria-controls'))),
      name: node.textContent.trim(), visible: visible(node),
    })),
    rows: Array.from(field?.querySelectorAll('button[data-date][aria-pressed]') || []).filter(visible).map(node => ({
      date: node.dataset.date, kind: node.dataset.kind, pressed: node.getAttribute('aria-pressed'),
      dimmed: node.dataset.dimmed, matched: node.dataset.matched,
      label: node.getAttribute('aria-label'), controls: node.getAttribute('aria-controls'), visible: visible(node),
      controlledRegion: document.getElementById(node.getAttribute('aria-controls')) === viewport,
      marks: Array.from(node.querySelectorAll('svg[data-kind]'), mark => mark.dataset.kind),
      hours: Array.from(node.querySelectorAll('[data-in-window]'), hour => ({
        inWindow: hour.dataset.inWindow, matched: hour.dataset.windowMatch,
      })),
    })),
  };
}

function requireLedger(condition, code, diagnostic) {
  if (condition) return;
  const error = new Error(code); error.diagnostic = diagnostic; throw error;
}

function expectedLedgerAnnotations(model, notes) {
  if (model.period.observedDayCount === 0) return notes.notes.map(note => ({ kind: 'today', id: note.id }));
  if (model.status === 'insufficient_history') return model.observations.way.sessionCount > 0
    ? [{ kind: 'early', id: 'short_sessions' }, { kind: 'early', id: 'longest_session' }] : [];
  if (model.status === 'observed_zero') return [];
  const annotations = model.patterns.map(pattern => ({ kind: 'pattern', id: pattern.id }));
  if (model.observations.change.available) annotations.push({ kind: 'change', id: 'change' });
  return annotations;
}

export function expectedZenLedgerAnnotationAnchor(model, notes, focus) {
  if (focus.kind === 'today' && notes.notes.some(note => note.id === focus.id)) return notes.dateStr;
  if (focus.kind === 'pattern') {
    const pattern = model.patterns.find(item => item.id === focus.id);
    if (pattern && pattern.matchedDates.length > 0) return pattern.matchedDates.at(-1);
  }
  if (focus.kind === 'early' && ['short_sessions', 'longest_session'].includes(focus.id)) {
    const day = model.days.findLast(item => item.observed && item.sessionCount > 0);
    if (day) return day.dateStr;
  }
  if (focus.kind === 'change' && focus.id === 'change' && model.observations.change.available) {
    const recent = model.observations.change.recent;
    const day = model.days.find(item => item.observed && item.dateStr >= recent.startDateStr && item.dateStr <= recent.endDateStr);
    if (day) return day.dateStr;
  }
  throw new Error('QA_ZEN_LEDGER_ANNOTATION_ANCHOR_INVALID');
}

export function inspectZenDaySlip() {
  const viewport = document.querySelector('#sites-site-detail .zen-site-ledger__viewport');
  const slip = viewport?.querySelector('.zen-site-ledger-slip[data-date][data-day-view]');
  const visible = node => Boolean(node?.getClientRects().length && !node.closest('[hidden], [inert], [aria-hidden="true"]'));
  const range = slip?.querySelector('[data-ledger-hour-select]');
  const result = slip?.querySelector('[data-selected-hour]');
  return {
    view: viewport?.dataset.view, date: slip?.dataset.date, dayView: slip?.dataset.dayView,
    selectedHour: viewport ? Number(viewport.dataset.selectedHour) : null, dayAnchor: viewport?.dataset.dayAnchor,
    focus: viewport?.dataset.focusKind ? { kind: viewport.dataset.focusKind, id: viewport.dataset.focusId } : null,
    inline: Boolean(slip && document.querySelector('#sites-site-detail').contains(slip)),
    visible: visible(slip), name: slip?.getAttribute('aria-label'),
    fieldAbsent: !viewport?.querySelector('.zen-site-ledger-field[role="group"]'),
    context: slip?.querySelector('[data-ledger-context]')?.textContent.trim(),
    actions: Array.from(slip?.querySelectorAll('[data-day-action]') || []).filter(visible).map(node => node.dataset.dayAction),
    range: range ? { visible: visible(range), type: range.type, min: range.min, max: range.max, step: range.step,
      value: Number(range.value), name: range.getAttribute('aria-label'), valueText: range.getAttribute('aria-valuetext'), focused: document.activeElement === range } : null,
    result: result ? { visible: visible(result), hour: Number(result.dataset.selectedHour), activeMs: Number(result.dataset.activeMs),
      text: result.textContent.trim(), durationText: result.querySelector('strong')?.textContent.trim() } : null,
    sessionValues: Array.from(slip?.querySelectorAll('dl dd') || []).filter(visible).map(node => node.textContent.trim()),
    hours: Array.from(slip?.querySelectorAll('[data-hour][data-active-ms]') || []).map(node => ({ hour: Number(node.dataset.hour), activeMs: Number(node.dataset.activeMs) })),
  };
}

export function requireZenLedgerHour(snapshot, hour, activeMs) {
  const seconds = Math.floor(activeMs / 1000), minutes = Math.floor(seconds / 60);
  const expectedNumbers = activeMs === 0 ? [0] : activeMs < 1000 ? [1]
    : seconds % 60 === 0 ? [minutes] : minutes === 0 ? [seconds] : [minutes, seconds % 60];
  const durationNumbers = snapshot.result?.durationText?.match(/\d+/gu)?.map(Number);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isFinite(activeMs) || activeMs < 0
    || snapshot.view !== 'slip' || snapshot.dayView !== 'hours' || !snapshot.visible
    || snapshot.selectedHour !== hour || !snapshot.range?.visible || snapshot.range.type !== 'range'
    || snapshot.range.min !== '0' || snapshot.range.max !== '23' || snapshot.range.step !== '1'
    || snapshot.range.value !== hour || !snapshot.range.name || !snapshot.range.valueText
    || !snapshot.result?.visible || snapshot.result.hour !== hour || snapshot.result.activeMs !== activeMs
    || !snapshot.result.text || JSON.stringify(durationNumbers) !== JSON.stringify(expectedNumbers)
    || !snapshot.range.valueText.includes(snapshot.result.durationText)) {
    const error = new Error('QA_ZEN_SITE_LEDGER_HOUR_SELECTION_FAILED'); error.diagnostic = snapshot; throw error;
  }
  return snapshot;
}

function inspectZenLedgerCapEditor() {
  const panel = document.querySelector('#sites-site-detail');
  const cap = panel?.querySelector('[data-site-cap][data-cap-presentation="anchored"]');
  const trigger = cap?.querySelector('button[aria-expanded][aria-controls]');
  const form = trigger && document.getElementById(trigger.getAttribute('aria-controls'));
  const input = form?.querySelector('input[type="number"]');
  const visible = node => Boolean(node?.getClientRects().length && !node.closest('[hidden], [inert]'));
  const bounds = node => {
    if (!node || !panel) throw new Error('QA_ZEN_SITE_LEDGER_CAP_GEOMETRY_REQUIRED');
    const owner = panel.getBoundingClientRect(), rect = node.getBoundingClientRect();
    return { left: rect.left - owner.left, top: rect.top - owner.top, width: rect.width, height: rect.height };
  };
  const fullyVisible = node => {
    if (!visible(node)) return false;
    const rect = node.getBoundingClientRect();
    if (rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1) return false;
    for (let owner = node.parentElement; owner; owner = owner.parentElement) {
      const css = getComputedStyle(owner), r = owner.getBoundingClientRect();
      if ((['auto', 'scroll', 'hidden', 'clip'].includes(css.overflowX)
          && (rect.left < r.left + owner.clientLeft - 1 || rect.right > r.left + owner.clientLeft + owner.clientWidth + 1))
        || (['auto', 'scroll', 'hidden', 'clip'].includes(css.overflowY)
          && (rect.top < r.top + owner.clientTop - 1 || rect.bottom > r.top + owner.clientTop + owner.clientHeight + 1))) return false;
    }
    return true;
  };
  const body = panel?.querySelector('.zen-site-ledger__viewport');
  return {
    mode: document.querySelector('.sites-sites-workspace')?.dataset.mode,
    presentation: cap?.dataset.capPresentation,
    triggerVisible: fullyVisible(trigger), triggerDisabled: trigger?.disabled,
    expanded: trigger?.getAttribute('aria-expanded'), label: trigger?.getAttribute('aria-label'),
    triggerRetained: trigger === window.__ENTROPY_SITES_INTEL_QA__?.capTrigger,
    triggerFocused: document.activeElement === trigger,
    formVisible: visible(form), formOwned: Boolean(form && cap.contains(form)),
    completeEditor: Boolean(form && [form, input, ...form.querySelectorAll('button')].every(fullyVisible)),
    inputFocused: Boolean(input && document.activeElement === input), inputEnabled: Boolean(input && !input.disabled && !input.readOnly),
    savePhase: cap?.dataset.savePhase,
    geometry: { body: bounds(body), today: bounds(panel?.querySelector('[data-time-kind="today"]')) },
  };
}

async function runZenLedgerCapEditor({ harness, page, capture, key, focusControl, back, mouseBack }) {
  const selector = '#sites-site-detail [data-site-cap][data-cap-presentation="anchored"] button[aria-expanded][aria-controls]';
  await focusControl(selector);
  await evaluate(harness.cdp, page.sessionId, '(() => { if (window.__ENTROPY_SITES_INTEL_QA__) throw new Error("QA_SITES_INTEL_PROBE_ALREADY_INSTALLED"); window.__ENTROPY_SITES_INTEL_QA__ = { capTrigger: document.querySelector(' + JSON.stringify(selector) + ') }; })()');
  const read = () => evaluate(harness.cdp, page.sessionId, '(' + inspectZenLedgerCapEditor.toString() + ')()');
  const stable = (before, after) => Object.keys(before.geometry).every(owner =>
    ['left', 'top', 'width', 'height'].every(dimension => Math.abs(after.geometry[owner][dimension] - before.geometry[owner][dimension]) <= 1));
  try {
    const before = await read();
    requireLedger(before.mode === 'notebook' && before.presentation === 'anchored' && before.triggerVisible
      && before.triggerRetained && before.triggerFocused && before.triggerDisabled === false
      && before.expanded === 'false' && !before.formVisible, 'QA_ZEN_SITE_LEDGER_CAP_TRIGGER_INVALID', before);
    await key('Enter', 13); await settleReading(harness, page);
    const opened = await read();
    requireLedger(opened.mode === 'notebook' && opened.triggerRetained && opened.triggerVisible
      && opened.triggerDisabled === true && opened.expanded === 'true' && opened.formVisible && opened.formOwned
      && opened.completeEditor && opened.inputFocused && opened.inputEnabled && stable(before, opened),
    'QA_ZEN_SITE_LEDGER_CAP_EDITOR_OPEN_FAILED', { before, opened });
    const access = await requireZenNotebookAccess({ harness, page, phase: 'cap-editor-open' });
    await capture('ledger-mixed-cap-editor');
    await key('Escape', 27); await settleReading(harness, page);
    const closed = await read();
    requireLedger(closed.mode === 'notebook' && closed.triggerRetained && closed.triggerVisible
      && closed.triggerDisabled === false && closed.expanded === 'false' && !closed.formVisible
      && closed.triggerFocused && closed.label === before.label && closed.savePhase === before.savePhase && stable(before, closed),
    'QA_ZEN_SITE_LEDGER_CAP_EDITOR_CANCEL_FAILED', { before, closed });
    const backCancellation = [];
    for (const [method, cancel] of [['visible-back', back], ['mouse-back', mouseBack]]) {
      await focusControl(selector); await key('Enter', 13); await settleReading(harness, page);
      const editing = await read();
      requireLedger(editing.formVisible && editing.completeEditor && editing.inputFocused && stable(before, editing),
        'QA_ZEN_SITE_LEDGER_CAP_BACK_OPEN_FAILED:' + method, editing);
      await cancel(); await settleReading(harness, page);
      const cancelled = await read();
      requireLedger(cancelled.mode === 'notebook' && cancelled.triggerRetained && cancelled.triggerVisible
        && cancelled.triggerDisabled === false && cancelled.expanded === 'false' && !cancelled.formVisible
        && cancelled.triggerFocused && cancelled.label === before.label && cancelled.savePhase === before.savePhase
        && stable(before, cancelled), 'QA_ZEN_SITE_LEDGER_CAP_BACK_CANCEL_FAILED:' + method, cancelled);
      backCancellation.push({ method, cancelled, access: await requireZenNotebookAccess({ harness, page, phase: 'cap-' + method }) });
    }
    return { before, opened, closed, access, backCancellation };
  } finally { await evaluate(harness.cdp, page.sessionId, 'delete window.__ENTROPY_SITES_INTEL_QA__'); }
}

async function runZenLedgerJourney({ harness, page, signal, capture, key }) {
  const browser = (fn, argument = null) => evaluate(harness.cdp, page.sessionId, '(' + fn.toString() + ')(' + JSON.stringify(argument) + ')');
  const wait = async (fn, argument = null) => {
    const deadline = Date.now() + 30000;
    do { signal?.throwIfAborted(); if (await browser(fn, argument)) return; await sleep(60); } while (Date.now() < deadline);
    throw Error('QA_ZEN_SINGLE_SHEET_WAIT_FAILED');
  };
  const click = selector => browser(selector => {
    const control = document.querySelector(selector);
    if (!control || !control.getClientRects().length || control.closest('[hidden], [inert], [aria-hidden="true"]')) throw Error('QA_ZEN_SINGLE_SHEET_CONTROL_REQUIRED:' + selector);
    control.click();
  }, selector);
  const cases = [];
  for (const id of Object.keys(SITE_INTEL_CAPTURE_CASES)) {
    const fixture = buildSiteIntelCaptureFixture(id, 'youtube.com');
    await browser(id => {
      const url = new URL(location.href); url.searchParams.set('entropy-qa-sites-intel', id);
      history.replaceState(null, '', url); window.dispatchEvent(new PopStateEvent('popstate'));
    }, id);
    await wait(id => document.querySelector('[data-intel-capture-case="' + id + '"]')
      && document.querySelector('#sites-site-detail .zen-site-ledger__viewport')?.getClientRects().length > 0, id);
    await settleReading(harness, page);
    const source = await browser(() => ({
      alert: document.querySelector('#sites-site-detail [role="alert"]')?.textContent,
      spread: document.querySelector('.sites-sites-workspace').dataset.notebookSpread,
    }));
    requireLedger(!source.alert && source.spread === 'false', 'QA_ZEN_SINGLE_SHEET_SOURCE_INVALID', source);
    // Date selection is direct; missing calendar dates remain individually reachable.
    const hasDay = await browser(() => Boolean(document.querySelector('[data-ledger-action="history"]')));
    if (!hasDay) await click('.zen-record-return');
    await click('#sites-site-detail [data-ledger-action="history"]'); await settleReading(harness, page);
    const allRows = [];
    for (let index = 0; index < 40; index++) {
      const rows = await browser(() => [...document.querySelectorAll('.zen-record-dates button[data-date]')]
        .filter(node => !node.closest('[aria-hidden="true"], [inert]')).map(node => ({ date: node.dataset.date, kind: node.dataset.kind, text: node.textContent,
          pressed: node.getAttribute('aria-pressed'), graphs: node.querySelectorAll('[data-hour]').length })));
      allRows.push(...rows);
      await requireZenNotebookAccess({ harness, page, phase: id + '-dates-' + index });
      const next = await browser(() => { const node = document.querySelector('.zen-record-dates [data-ledger-action="next-page"]'); return Boolean(node && !node.disabled); });
      if (!next) break;
      await click('.zen-record-dates [data-ledger-action="next-page"]'); await settleReading(harness, page);
      if (index === 39) throw Error('QA_ZEN_SINGLE_SHEET_DATE_PAGE_LIMIT');
    }
    // The starting page is anchored to the current day. Walk back to verify the complete window.
    for (let index = 0; index < 40; index++) {
      const previous = await browser(() => { const node = document.querySelector('.zen-record-dates [data-ledger-action="previous-page"]'); return Boolean(node && !node.disabled); });
      if (!previous) break;
      await click('.zen-record-dates [data-ledger-action="previous-page"]'); await settleReading(harness, page);
      allRows.push(...await browser(() => [...document.querySelectorAll('.zen-record-dates button[data-date]')]
        .filter(node => !node.closest('[aria-hidden="true"], [inert]')).map(node => ({ date: node.dataset.date, kind: node.dataset.kind, text: node.textContent, graphs: node.querySelectorAll('[data-hour]').length }))));
    }
    const unique = [...new Map(allRows.map(row => [row.date, row])).values()].sort((a, b) => a.date.localeCompare(b.date));
    const expected = [...fixture.longTermPatterns.days, { dateStr: fixture.todayDateStr, observed: fixture.todayObserved, activeMs: fixture.todayTotal }];
    requireLedger(unique.length === expected.length && unique.every((row, index) => row.date === expected[index].dateStr
      && row.graphs === 0 && row.kind === (!expected[index].observed ? 'missing' : expected[index].activeMs === 0 ? 'zero' : 'observed')),
    'QA_ZEN_SINGLE_SHEET_DATES_MISMATCH', { unique, expected });
    // End at today's page and choose the actual published date.
    for (let index = 0; index < 40; index++) {
      const selected = await browser(date => {
        const node = [...document.querySelectorAll('.zen-record-dates button[data-date]')].find(node => node.dataset.date === date && !node.closest('[aria-hidden="true"], [inert]'));
        if (node) { node.click(); return true; }
        const next = document.querySelector('.zen-record-dates [data-ledger-action="next-page"]');
        if (!next || next.disabled) throw Error('QA_ZEN_SINGLE_SHEET_DATE_UNREACHABLE'); next.click(); return false;
      }, fixture.todayDateStr);
      await settleReading(harness, page); if (selected) break;
    }
    await requireZenNotebookAccess({ harness, page, phase: id + '-day' });
    if (['first-day', 'mixed', 'missing'].includes(id)) await capture('single-sheet-' + id);
    let hourProof = null;
    if (fixture.todayObserved) {
      await click('#sites-site-detail [data-day-action="hours"]'); await settleReading(harness, page);
      await browser(() => document.querySelector('[data-ledger-hour-select]').focus({ preventScroll: true }));
      await key('Home', 36);
      for (let hour = 0; hour < 24; hour++) {
        if (hour > 0) await key('ArrowRight', 39);
        await settleReading(harness, page);
        hourProof = requireZenLedgerHour(await evaluate(harness.cdp, page.sessionId, '(' + inspectZenDaySlip.toString() + ')()'), hour, fixture.todayHourly[hour]);
      }
      await requireZenNotebookAccess({ harness, page, phase: id + '-hours' });
      if (id === 'mixed') await capture('single-sheet-hours');
      await click('#sites-site-detail [data-day-action="sessions"]'); await settleReading(harness, page);
      const sessionProof = await evaluate(harness.cdp, page.sessionId, '(' + inspectZenDaySlip.toString() + ')()');
      requireLedger(JSON.stringify(sessionProof.sessionValues.map(value => Number(value.match(/\d+/u)?.[0]))) === JSON.stringify([
        fixture.todaySessionStats.shortCount, fixture.todaySessionStats.count - fixture.todaySessionStats.shortCount - fixture.todaySessionStats.longCount, fixture.todaySessionStats.longCount,
      ]), 'QA_ZEN_SINGLE_SHEET_SESSIONS_MISMATCH', sessionProof);
      await requireZenNotebookAccess({ harness, page, phase: id + '-sessions' });
      await click('#sites-site-detail [data-day-action="summary"]'); await settleReading(harness, page);
    }
    await click('#sites-site-detail [data-ledger-action="basis"]'); await settleReading(harness, page);
    for (let index = 0; index < 20; index++) {
      await requireZenNotebookAccess({ harness, page, phase: id + '-basis-' + index });
      const next = await browser(() => { const node = document.querySelector('.zen-record-basis [data-ledger-action="next-page"]'); return Boolean(node && !node.disabled); });
      if (!next) break;
      await click('.zen-record-basis [data-ledger-action="next-page"]'); await settleReading(harness, page);
    }
    await click('#sites-site-detail [data-ledger-action="back"]'); await settleReading(harness, page);
    if (fixture.longTermPatterns.patterns.length > 0) {
      const before = await browser(() => document.querySelector('.zen-site-ledger__viewport').dataset.selectedDate);
      const compact = await browser(() => Boolean(document.querySelector('[data-ledger-action="annotations"]')));
      if (compact) { await click('[data-ledger-action="annotations"]'); await settleReading(harness, page); }
      const order = await browser(() => [...document.querySelectorAll('[data-annotation-kind="pattern"]')].map(node => node.dataset.annotationId));
      requireLedger(JSON.stringify(order) === JSON.stringify(fixture.longTermPatterns.patterns.map(item => item.id)), 'QA_ZEN_SINGLE_SHEET_PATTERN_ORDER', order);
      await click('[data-annotation-kind="pattern"]'); await settleReading(harness, page);
      requireLedger(await browser(date => document.querySelector('.zen-site-ledger__viewport').dataset.selectedDate === date, before), 'QA_ZEN_SINGLE_SHEET_PATTERN_CHANGED_DATE', before);
      await requireZenNotebookAccess({ harness, page, phase: id + '-highlight' });
      if (compact) { await click('.zen-record-return'); await settleReading(harness, page); }
    }
    if (id === 'mixed') {
      const before = await browser(() => { const r = document.querySelector('.zen-site-ledger__viewport').getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; });
      await click('.zen-record-management > summary'); await settleReading(harness, page);
      await requireZenNotebookAccess({ harness, page, phase: 'management' });
      await click('.zen-record-management [data-site-cap] .sites-cap-readout__value'); await settleReading(harness, page);
      await requireZenNotebookAccess({ harness, page, phase: 'management-cap' });
      await key('Escape', 27); await settleReading(harness, page);
      requireLedger(await browser(() => document.querySelector('.zen-record-management').open && !document.querySelector('.zen-record-management form')), 'QA_ZEN_SINGLE_SHEET_CAP_CANCEL', null);
      await key('Escape', 27); await settleReading(harness, page);
      const after = await browser(() => { const r = document.querySelector('.zen-site-ledger__viewport').getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; });
      requireLedger(before.every((value, index) => Math.abs(value - after[index]) < 1), 'QA_ZEN_SINGLE_SHEET_MANAGEMENT_MOVED_READING', {before,after});
    }
    cases.push({ id, dates: unique.length, source: 'production-read-model-fixture', hourlyValuesChecked: hourProof ? 24 : 0 });
  }
  await browser(() => document.querySelector('[data-workspace-action="back"]').focus({preventScroll:true}));
  await key('Escape', 27); await settleReading(harness, page);
  requireLedger(await browser(() => document.querySelector('.sites-sites-workspace').dataset.mode === 'ledger'), 'QA_ZEN_SINGLE_SHEET_BACK_FAILED', null);
  await capture('single-sheet-registry');
  await click('button[aria-controls="sites-site-detail"][title="youtube.com"]'); await settleReading(harness, page);
  const point = await browser(() => { const r = document.querySelector('.sites-notebook-heading').getBoundingClientRect(); return {x:r.left+12,y:r.top+12}; });
  for (const type of ['mousePressed', 'mouseReleased']) await harness.cdp.send('Input.dispatchMouseEvent', {...point,type,button:'back',clickCount:1}, page.sessionId);
  await settleReading(harness, page);
  requireLedger(await browser(() => document.querySelector('.sites-sites-workspace').dataset.mode === 'ledger'), 'QA_ZEN_SINGLE_SHEET_MOUSE_BACK_FAILED', null);
  return { fixtureOnly: true, noStorageWrites: true, presentation: 'zen-single-sheet-v2', cases,
    limitation: 'Source fixtures certify bounded presentation and exact read values. They do not certify collection or personal-profile records.' };
}

export async function runDashboardSitesIntelJourney({ harness, page, signal, capture }) {
  const cases = [];
  const key = async (name, code) => {
    // Chromium native Enter activation needs the carriage-return text, as in Playwright's keydown recipe.
    await harness.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code,
      ...(name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) }, page.sessionId);
    await harness.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code }, page.sessionId);
  };
  await evaluate(harness.cdp, page.sessionId, `(() => {
    const url = new URL(location.href);
    url.searchParams.set('tab', 'sites'); url.searchParams.set('domain', 'youtube.com');
    history.replaceState(null, '', url); window.dispatchEvent(new PopStateEvent('popstate'));
  })()`);
  const zenLedger = await evaluate(harness.cdp, page.sessionId, 'document.querySelector("#sites-site-detail")?.dataset.variant === "zen"');
  if (zenLedger) return runZenLedgerJourney({ harness, page, signal, capture, key });
  await capture('workspace');
  const readingSelector = '#sites-site-detail [data-intel-state]';
  for (const id of SITE_INTEL_INTERPRETATION_CAPTURE_CASE_IDS) {
    signal?.throwIfAborted();
    const profile = buildSiteIntelCaptureFixture(id, 'youtube.com').sitePullProfile;
    await evaluate(harness.cdp, page.sessionId, `(() => {
      const url = new URL(location.href); url.searchParams.set('entropy-qa-sites-intel', ${JSON.stringify(id)});
      history.replaceState(null, '', url); window.dispatchEvent(new PopStateEvent('popstate'));
    })()`);
    let snapshot;
    const deadline = Date.now() + 30_000;
    do {
      signal?.throwIfAborted();
      snapshot = await evaluate(harness.cdp, page.sessionId, `(() => {
        const panel = document.querySelector('#sites-site-detail');
        const body = document.querySelector(${JSON.stringify(readingSelector)});
        const rect = panel?.getBoundingClientRect();
        const measure = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const readingNodes = [...body?.querySelectorAll('.site-intel__narrative, .site-intel__evidence, .site-intel__reading') || []];
        return { id: panel?.querySelector('[data-intel-capture-case]')?.dataset.intelCaptureCase,
          mode: document.querySelector('.sites-sites-workspace')?.dataset.mode,
          reachable: Boolean(panel?.getClientRects().length && body?.getClientRects().length),
          state: body?.dataset.intelState, pattern: body?.dataset.intelPattern, kind: body?.dataset.intelKind,
          text: body?.innerText, width: rect?.width,
          metrics: [...body?.querySelectorAll('[data-metric-id]') || []].map(node => ({ id: node.dataset.metricId, ...measure(node) })),
          stage: body?.querySelector('.site-intel__focus') ? measure(body.querySelector('.site-intel__focus')) : null,
          evidence: body?.querySelector('.site-intel__evidence') ? measure(body.querySelector('.site-intel__evidence')) : null,
          hourly: body?.querySelector('.site-intel__hourly') ? measure(body.querySelector('.site-intel__hourly')) : null,
          overflow: panel ? panel.scrollWidth > panel.clientWidth + 1
            || readingNodes.some(node => node.scrollWidth > node.clientWidth + 1)
            || document.querySelector('#sites-tab').scrollWidth > document.querySelector('#sites-tab').clientWidth + 1 : null,
          view: body?.dataset.intelPage,
          hourlySeries: body?.querySelector('[data-hourly-series]')?.dataset.hourlySeries,
          clippedContent: readingNodes.some(node => node.scrollHeight > node.clientHeight + 1
            && ['hidden', 'clip'].includes(getComputedStyle(node).overflowY)),
          alert: panel?.querySelector('[role=alert]')?.textContent || body?.querySelector('[role=alert]')?.textContent };
      })()`);
      if (snapshot.id === id && snapshot.state && !snapshot.alert) break;
      await sleep(50);
    } while (Date.now() < deadline);
    const expected = profile.interpretation;
    if (snapshot.id !== id || snapshot.alert || !snapshot.state || snapshot.mode !== 'notebook'
      || !snapshot.reachable || snapshot.overflow || snapshot.clippedContent
      || snapshot.text?.includes('intel_reading.')
      || snapshot.state !== (expected.headline.kind === 'pattern' ? 'observed' : expected.headline.state)
      || JSON.stringify(snapshot.metrics.map(item => item.id)) !== JSON.stringify(expected.reading.primaryEvidenceIds)
      || (expected.headline.kind === 'pattern' && snapshot.pattern !== expected.headline.patternId)) {
      const error = new Error('QA_SITES_INTEL_READING_MISMATCH:' + id); error.diagnostic = snapshot; throw error;
    }
    if (snapshot.metrics.some(metric => metric.width <= 0 || metric.height <= 0)) {
      throw new Error('QA_SITES_INTEL_EVIDENCE_NOT_REACHABLE:' + id);
    }
    await evaluate(harness.cdp, page.sessionId, `(async () => {
      document.querySelector('#sites-site-detail').scrollIntoView({ block: 'nearest', behavior: 'instant' });
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })()`);
    await sleep(150);
    await capture(id);
    await evaluate(harness.cdp, page.sessionId, `(() => {
      const tab = document.querySelector(${JSON.stringify(readingSelector)}).querySelector('[role="tab"][aria-selected="false"]');
      tab.focus({ preventScroll: true }); tab.click();
    })()`);
    await sleep(50);
    const evidence = await evaluate(harness.cdp, page.sessionId, `(() => {
      const panel = document.querySelector('#sites-site-detail');
      const reading = document.querySelector(${JSON.stringify(readingSelector)});
      const graph = reading.querySelector('.site-intel__hourly'), r = graph.getBoundingClientRect();
      return { page: reading.dataset.intelPage,
        series: graph.dataset.hourlySeries, relation: graph.dataset.hourlyRelation,
        hourly: { y: r.y, height: r.height, width: r.width },
        reachable: Boolean(graph.getClientRects().length && reading.querySelector('[role="tabpanel"]').getClientRects().length),
        overflow: panel.scrollWidth > panel.clientWidth + 1,
        clippedContent: [...reading.querySelectorAll('.site-intel__narrative, .site-intel__evidence, .site-intel__reading')]
          .some(node => node.scrollHeight > node.clientHeight + 1
            && ['hidden', 'clip'].includes(getComputedStyle(node).overflowY)) };
    })()`);
    if (evidence.page !== 'evidence' || !evidence.reachable || evidence.clippedContent
      || evidence.overflow || evidence.hourly.width <= 0 || evidence.hourly.height <= 0) {
      const error = new Error('QA_SITES_INTEL_EVIDENCE_LAYOUT_INVALID:' + id); error.diagnostic = { snapshot, evidence }; throw error;
    }
    const firstEvidenceId = expected.reading.primaryEvidenceIds[0];
    const firstMetric = expected.reading.claims.flatMap(claim => claim.metrics).find(metric => metric.id === firstEvidenceId);
    const expectedSeries = firstMetric?.period === 'today' && firstMetric.field === 'todayVisits' ? 'today_visits'
      : firstMetric?.period === 'today' && ['todayMs', 'todayTotalMs'].includes(firstMetric.field) ? 'today_usage' : 'recent_usage';
    if (evidence.series !== expectedSeries || snapshot.hourlySeries !== expectedSeries) throw new Error('QA_SITES_INTEL_EVIDENCE_PERIOD_INVALID:' + id);
    // A same-site presentation refresh must retain the admitted reading, page,
    // graph and keyboard focus. Real facts refresh is covered by recording-refresh.
    await evaluate(harness.cdp, page.sessionId, `(() => {
      if (window.__ENTROPY_SITES_INTEL_QA__) throw new Error('QA_SITES_INTEL_PROBE_ALREADY_INSTALLED');
      const panel = document.querySelector('#sites-site-detail');
      const reading = document.querySelector(${JSON.stringify(readingSelector)});
      window.__ENTROPY_SITES_INTEL_QA__ = { panel, reading,
        graph: reading.querySelector('.site-intel__hourly'), focus: document.activeElement };
    })()`);
    let continuity;
    try {
      await evaluate(harness.cdp, page.sessionId, `(async () => {
        window.dispatchEvent(new PopStateEvent('popstate'));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      })()`);
      continuity = await evaluate(harness.cdp, page.sessionId, `(() => {
        const before = window.__ENTROPY_SITES_INTEL_QA__;
        const panel = document.querySelector('#sites-site-detail');
        return { panel: panel === before.panel && panel.isConnected,
          reading: document.querySelector(${JSON.stringify(readingSelector)}) === before.reading && before.reading.dataset.intelPage === 'evidence',
          graph: before.reading.querySelector('.site-intel__hourly') === before.graph,
          focus: document.activeElement === before.focus };
      })()`);
      if (Object.values(continuity).some(value => value !== true)) {
        const error = new Error('QA_SITES_INTEL_CONTINUITY_LOST:' + id); error.diagnostic = continuity; throw error;
      }
    } finally {
      await evaluate(harness.cdp, page.sessionId, 'delete window.__ENTROPY_SITES_INTEL_QA__');
    }
    if (['long', 'repeated', 'comparison', 'missing'].includes(id)) await capture(id + '-evidence');
    await evaluate(harness.cdp, page.sessionId, `document.querySelector(${JSON.stringify(readingSelector)}).querySelector('[role="tab"]').click()`);
    cases.push({ evidence, continuity, id, expectedHeadline: expected.headline, modelVersion: profile.modelVersion, ...snapshot });
  }
  await evaluate(harness.cdp, page.sessionId, `document.querySelector(${JSON.stringify(readingSelector)}).querySelector('[role="tab"]').focus({ preventScroll: true })`);
  await key('ArrowRight', 39);
  const opened = await evaluate(harness.cdp, page.sessionId, `(() => {
    const reading = document.querySelector(${JSON.stringify(readingSelector)});
    const selected = reading.querySelector('[role="tab"][aria-selected="true"]');
    if (reading.dataset.intelPage !== 'evidence' || document.activeElement !== selected) throw new Error('QA_SITES_INTEL_TABS_FAILED');
    return true;
  })()`);
  await key('Escape', 27);
  const closed = await evaluate(harness.cdp, page.sessionId, `(() => {
    const reading = document.querySelector(${JSON.stringify(readingSelector)});
    const summary = reading.querySelector('[role="tab"]');
    if (summary.getAttribute('aria-selected') !== 'true' || document.activeElement !== summary) throw new Error('QA_SITES_INTEL_ESCAPE_FAILED');
    reading.querySelector('.site-intel__hourly-bin').focus({ preventScroll: true }); return true;
  })()`);
  await key('End', 35);
  const hourlyKeyboard = await evaluate(harness.cdp, page.sessionId, `(() => {
    const bins = document.querySelector(${JSON.stringify(readingSelector)}).querySelectorAll('.site-intel__hourly-bin');
    if (document.activeElement !== bins[23] || bins[23].getAttribute('aria-pressed') !== 'true') throw new Error('QA_SITES_INTEL_HOURLY_KEYBOARD_FAILED');
    return true;
  })()`);
  await evaluate(harness.cdp, page.sessionId, `(async () => {
    const policy = document.querySelector('.sites-site-policy-header');
    if (!policy?.getClientRects().length) throw new Error('QA_SITES_INTEL_POLICY_NOT_REACHABLE');
    policy.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  })()`);
  await capture('protection');
  const waitForWorkspaceMode = async (mode) => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      signal?.throwIfAborted();
      const ready = await evaluate(harness.cdp, page.sessionId,
        `document.querySelector('.sites-sites-workspace')?.dataset.mode === ${JSON.stringify(mode)}`);
      if (ready) {
        await evaluate(harness.cdp, page.sessionId, `(async () => {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        })()`);
        return;
      }
      await sleep(50);
    }
    throw new Error('QA_SITES_INTEL_WORKSPACE_MODE_TIMEOUT:' + mode);
  };
  const notebookReadingSelector = '[data-intel-state]';
  const notebookGraphSelector = '.site-intel__hourly';
  await evaluate(harness.cdp, page.sessionId, `(() => {
    if (window.__ENTROPY_SITES_INTEL_QA__) throw new Error('QA_SITES_INTEL_PROBE_ALREADY_INSTALLED');
    const panel = document.querySelector('#sites-site-detail');
    const reading = panel.querySelector(${JSON.stringify(notebookReadingSelector)});
    window.__ENTROPY_SITES_INTEL_QA__ = { panel, reading,
      graph: reading.querySelector(${JSON.stringify(notebookGraphSelector)}) };
    document.querySelector('.sites-notebook-heading__back').click();
  })()`);
  let navigation;
  try {
    await waitForWorkspaceMode('ledger');
    const ledger = await evaluate(harness.cdp, page.sessionId, `(() => {
      const before = window.__ENTROPY_SITES_INTEL_QA__, panel = document.querySelector('#sites-site-detail');
      const row = [...document.querySelectorAll('button[aria-controls="sites-site-detail"]')].find(node => node.title === 'youtube.com');
      const search = document.querySelector('.sites-unified-registry__search input');
      return { mode: document.querySelector('.sites-sites-workspace').dataset.mode,
        visible: Boolean(document.querySelector('.sites-sites-workspace__registry').getClientRects().length),
        detailRetained: panel === before.panel && panel.isConnected,
        readingRetained: panel.querySelector(${JSON.stringify(notebookReadingSelector)}) === before.reading,
        detailHidden: panel.getClientRects().length === 0,
        focusRestored: Boolean(document.activeElement === row || (search && document.activeElement === search)) };
    })()`);
    if (ledger.mode !== 'ledger' || Object.entries(ledger).some(([key, value]) => key !== 'mode' && value !== true)) {
      const error = new Error('QA_SITES_INTEL_LEDGER_RETURN_FAILED'); error.diagnostic = ledger; throw error;
    }
    await capture('ledger');
    await evaluate(harness.cdp, page.sessionId, `(() => {
      const row = [...document.querySelectorAll('button[aria-controls="sites-site-detail"]')].find(node => node.title === 'youtube.com');
      if (!row?.getClientRects().length) throw new Error('QA_SITES_INTEL_REOPEN_ROW_NOT_REACHABLE');
      row.click();
    })()`);
    await waitForWorkspaceMode('notebook');
    const notebook = await evaluate(harness.cdp, page.sessionId, `(() => {
      const before = window.__ENTROPY_SITES_INTEL_QA__, panel = document.querySelector('#sites-site-detail');
      return { mode: document.querySelector('.sites-sites-workspace').dataset.mode,
        visible: Boolean(panel.getClientRects().length),
        detailRetained: panel === before.panel && panel.isConnected,
        readingRetained: panel.querySelector(${JSON.stringify(notebookReadingSelector)}) === before.reading,
        graphRetained: before.reading.querySelector(${JSON.stringify(notebookGraphSelector)}) === before.graph,
        ledgerHidden: document.querySelector('.sites-sites-workspace__registry').getClientRects().length === 0 };
    })()`);
    if (notebook.mode !== 'notebook' || Object.entries(notebook).some(([key, value]) => key !== 'mode' && value !== true)) {
      const error = new Error('QA_SITES_INTEL_NOTEBOOK_REOPEN_FAILED'); error.diagnostic = notebook; throw error;
    }
    await capture('notebook');
    navigation = { ledger, notebook };
  } finally {
    await evaluate(harness.cdp, page.sessionId, 'delete window.__ENTROPY_SITES_INTEL_QA__');
  }
  return { fixtureOnly: true, noStorageWrites: true, cases, keyboard: { opened, closed, hourlyKeyboard }, navigation,
    limitation: 'Source fixtures pass through the existing model. This checks presentation in the full workspace, not collection or model accuracy.' };
}
