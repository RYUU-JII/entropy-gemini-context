import { evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';

const PROBE_KEY = '__ENTROPY_QA_PRESSURE_RAIL_JOURNEY__';

export async function preparePressureRailLedgerFixture(send) {
  const domains = ['dominant.pressure.lab', 'large.edge.lab'];
  for (const domain of domains) {
    const response = await send({ action: MESSAGE_ACTIONS.UPSERT_SITE_RULE, domain, type: 'blocked', goalMinutes: 30 });
    if (response?.success !== true) throw new Error('QA_PRESSURE_RAIL_LEDGER_RULE_COMMIT_FAILED');
  }
  const response = await send({ action: MESSAGE_ACTIONS.GET_SITES_SNAPSHOT });
  if (response?.success !== true || domains.some(domain => response.sitesSnapshot?.siteRegistry?.byDomain?.[domain]?.type !== 'blocked')) {
    throw new Error('QA_PRESSURE_RAIL_LEDGER_FIXTURE_ADMISSION_FAILED');
  }
  return { domains, source: 'canonical_rule_commands', historicalRecordsAdded: false };
}

export function requirePressureRailLedgerReading(sample) {
  const ledger = sample.ledgerReading;
  if (sample.sitesMode !== 'ledger' || !ledger?.ready || ledger.rowCount !== 2
    || !Number.isFinite(ledger.safeRight) || ledger.safeRight < 0
    || !Number.isFinite(ledger.inkLeft) || !Number.isFinite(ledger.inkRight) || ledger.inkRight <= ledger.inkLeft
    || !ledger.controls.length || ledger.controls.some(bounds => !bounds
      || !['x', 'right', 'width'].every(key => Number.isFinite(bounds[key])) || bounds.width <= 0
      || bounds.right > ledger.inkRight + 0.75 || bounds.x < ledger.inkLeft - 0.75)) {
    throw new Error('QA_PRESSURE_RAIL_LEDGER_READING_OCCLUDED');
  }
  return sample;
}

export function requirePressureRailJourney({ enabled, surface, theme, pressureState, koiState,
  firstVisionJourney, firstSiteJourney, mainReturnJourney }) {
  if (enabled !== true) return false;
  if (surface !== 'main' || theme !== 'zen' || pressureState !== 'ready' || koiState !== 'full'
    || firstVisionJourney || firstSiteJourney || mainReturnJourney) {
    throw new Error('QA_PRESSURE_RAIL_JOURNEY_REQUIRES_READY_ZEN_MAIN_FULL_ROSTER');
  }
  return true;
}

export function requirePressureRailSample(before, sample) {
  if (!Array.isArray(before?.segments) || !Array.isArray(sample?.segments)
    || sample.segments.length !== before.segments.length || sample.segments.some((segment, index) =>
      segment.domain !== before.segments[index].domain
      || !Number.isFinite(segment.pressureShare) || !Number.isFinite(segment.width)
      || segment.pressureShare !== before.segments[index].pressureShare
      || Math.abs(segment.width - before.segments[index].width) > 0.5)) {
    throw new Error('QA_PRESSURE_RAIL_INTERACTION_CHANGED_ALLOCATION');
  }
  if (sample.selectedDomain !== null || sample.readout !== null) {
    throw new Error('QA_PRESSURE_RAIL_RETIRED_LOCK_OR_READOUT_PRESENT');
  }
  if (sample.bonsai?.sameCanvas !== true || sample.bonsai.canvasCount !== 1
    || sample.bonsai.replaced !== false || sample.bonsai.visible !== true) {
    throw new Error('QA_PRESSURE_RAIL_BONSAI_CANVAS_REPLACED_OR_HIDDEN');
  }
  return sample;
}

export function requirePressureRailClipSample(sample) {
  if (!Array.isArray(sample.clipFrames) || sample.clipFrames.length !== 3
    || sample.clipFrames.some(frame => !Number.isFinite(frame.scrollTop)
      || !Number.isFinite(frame.scrollLeft) || frame.scrollTop !== 0 || frame.scrollLeft !== 0)) {
    throw new Error('QA_PRESSURE_RAIL_PRESENTATION_CLIP_SCROLLED');
  }
  return sample;
}

export function requirePressureRailWorkspaceSample(sample, { mode, view = null, domain = null }) {
  if (sample.mode !== mode || sample.activeTab !== (mode === 'pond' ? 'main' : 'sites')
    || sample.edge?.expanded !== (mode === 'pathways') || sample.edge.busy) {
    throw new Error('QA_PRESSURE_RAIL_WORKSPACE_ROUTE_MISMATCH');
  }
  if (view !== null && sample.sitesMode !== view) throw new Error('QA_PRESSURE_RAIL_SITES_VIEW_MISMATCH');
  if (domain !== null && sample.notebookDomain !== domain) throw new Error('QA_PRESSURE_RAIL_INTEL_DOMAIN_MISMATCH');
  if (mode !== 'pathways') return sample;
  if (!['landscape', 'portrait-compact', 'portrait-desktop'].includes(sample.layoutMode)) {
    throw new Error('QA_PRESSURE_RAIL_LAYOUT_MODE_REQUIRED');
  }
  const { stage, pond, sheet, sheetViewport, graph, panelLineX } = sample;
  const required = sample.layoutMode === 'landscape'
    ? { x: stage?.x, y: stage?.y, right: panelLineX, bottom: graph?.y }
    : { x: pond?.x, y: pond?.y, right: pond?.right, bottom: pond?.bottom };
  if (!sheet || !sheetViewport || sheet.opaque !== true || sheet.inert !== false
    || !Object.values(required).every(Number.isFinite)
    || [sheet, sheetViewport].some(rect => !['x', 'y', 'right', 'bottom', 'width', 'height']
      .every(key => Number.isFinite(rect[key])) || rect.width <= 0 || rect.height <= 0
      || Math.abs(rect.x - required.x) > 0.75 || Math.abs(rect.y - required.y) > 0.75
      || Math.abs(rect.right - required.right) > 0.75 || Math.abs(rect.bottom - required.bottom) > 0.75)) {
    throw new Error('QA_PRESSURE_RAIL_SHEET_DOES_NOT_COVER_POND_TO_PANEL');
  }
  // Transparent crown paint may overlap the sheet. The real panel line and
  // graph datum, rather than a canvas bounding box, define its coverage.
  return sample;
}

export function requirePressureRailPondResumeSample(before, sample) {
  requirePressureRailWorkspaceSample(sample, { mode: 'pond' });
  if (sample.pondCanvas?.sameCanvas !== true || sample.pondCanvas.visible !== true
    || !Number.isFinite(before.sampleFrames) || !Number.isFinite(sample.sampleFrames)
    || sample.sampleFrames <= before.sampleFrames) throw new Error('QA_PRESSURE_RAIL_POND_NOT_RESUMED');
  if (sample.traceMode === 'off' || sample.traceMode === 'marks') {
    return { status: 'unavailable', reason: 'trace_' + sample.traceMode,
      evidence: 'committed_pond_route_after_product_ack_gate_and_worker_progress',
      currentFrameVerified: false, sampleFrames: sample.sampleFrames };
  }
  const ack = sample.pondResumeAck;
  if (sample.traceMode !== 'full' || !Number.isInteger(before.traceIndex)
    || !before.traceSessionId || sample.traceSessionId !== before.traceSessionId
    || !Number.isInteger(ack?.index) || ack.index <= before.traceIndex
    || typeof ack.sceneCommitKey !== 'string' || !ack.sceneCommitKey
    || !['worker_presentation_scene_frame_ack', 'retained_presentation_scene_ack_replay'].includes(ack.reason)) {
    throw new Error('QA_PRESSURE_RAIL_POND_RESUME_ACK_MISSING');
  }
  return { status: 'ready', evidence: 'accepted_presentation_ack_and_worker_progress',
    currentFrameVerified: true, ...ack, sampleFrames: sample.sampleFrames };
}

function installPressureRailProbe(key) {
  if (Object.hasOwn(globalThis, key)) throw new Error('QA_PRESSURE_RAIL_PROBE_EXISTS');
  const bonsaiSelector = '[data-main-presentation-surface="bonsai"] canvas';
  const pondSelector = '[data-main-presentation-surface="pond"] canvas';
  const bonsaiCanvas = document.querySelector(bonsaiSelector), pondCanvas = document.querySelector(pondSelector);
  if (!bonsaiCanvas || !pondCanvas) throw new Error('QA_PRESSURE_RAIL_INITIAL_CANVAS_MISSING');
  let replaced = false;
  const checkIdentity = () => {
    if (!bonsaiCanvas.isConnected || document.querySelector(bonsaiSelector) !== bonsaiCanvas
      || document.querySelectorAll(bonsaiSelector).length !== 1) replaced = true;
  };
  const observer = new MutationObserver(checkIdentity);
  observer.observe(document.getElementById('root'), { childList: true, subtree: true });
  const edgeInputEvents = [];
  const edgeInputTypes = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture'];
  const observeEdgeInput = event => {
    const edge = document.querySelector('.zen-garden-paper-edge');
    edgeInputEvents.push({ type:event.type, atMs:performance.now(), pointerId:event.pointerId,
      button:event.button, buttons:event.buttons, x:event.clientX, y:event.clientY,
      targetIsEdge:edge?.contains(event.target) === true, edgeDisabled:edge?.disabled,
      captured:edge?.hasPointerCapture(event.pointerId) === true });
    if (edgeInputEvents.length > 32) edgeInputEvents.shift();
  };
  edgeInputTypes.forEach(type => window.addEventListener(type, observeEdgeInput, true));
  const rect = node => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
  };
  const visible = node => Boolean(node?.isConnected && node.width > 1 && node.height > 1
    && node.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0);
  const colorProbe = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently:true });
  if (!colorProbe) throw new Error('QA_PRESSURE_RAIL_COLOR_MEASUREMENT_UNAVAILABLE');
  const opaqueColor = color => {
    if (!CSS.supports('color', color)) return false;
    colorProbe.clearRect(0, 0, 1, 1);
    colorProbe.fillStyle = color;
    colorProbe.fillRect(0, 0, 1, 1);
    return colorProbe.getImageData(0, 0, 1, 1).data[3] === 255;
  };
  const opaquePaper = style => {
    if (style.opacity !== '1') return false;
    if (style.backgroundImage === 'none') return opaqueColor(style.backgroundColor);
    // Zen's canonical L2 paper is one vertical gradient. Split only its outer
    // arguments so native rgb()/color() commas never become separate stops.
    const image = style.backgroundImage;
    if (!image.startsWith('linear-gradient(') || !image.endsWith(')')) return false;
    const source = image.slice(16, -1), parts = [];
    let depth = 0, start = 0;
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] === '(') depth += 1;
      else if (source[index] === ')') depth -= 1;
      else if (source[index] === ',' && depth === 0) {
        parts.push(source.slice(start, index).trim()); start = index+1;
      }
    }
    parts.push(source.slice(start).trim());
    // CSSOM may omit the default 180deg direction when serializing the same
    // declared gradient. Accept those two native forms, still requiring both
    // canonical stops to be independently opaque.
    const stops = parts.length === 3 && parts[0] === '180deg' ? parts.slice(1) : parts;
    return depth === 0 && stops.length === 2 && stops.every(opaqueColor);
  };
  const read = () => {
    checkIdentity();
    const rail = document.querySelector('[data-testid="zen-pressure-rail"]');
    if (!rail) throw new Error('QA_PRESSURE_RAIL_MISSING');
    const stage = document.querySelector('.zen-home-stage'), sheet = document.getElementById('zen-garden-ledger');
    const edge = document.querySelector('.zen-garden-paper-edge'), line = document.querySelector('.zen-home-garden-depth line');
    const faces = [...rail.querySelectorAll('[data-pressure-target="site"]')];
    const selected = faces.filter(node => node.getAttribute('aria-pressed') === 'true');
    const history = globalThis.__ENTROPY_ZEN_RENDER_TRACE__?.history?.();
    const entries = Array.isArray(history) ? history : [], last = entries.at(-1);
    const resumeEntry = entries.findLast(entry => ['pond_controller:presentation_scene_frame_committed',
      'pond_controller:retained_scene_ack_replayed'].includes(entry.event));
    const rawTraceMode = new URLSearchParams(location.search).get('entropy-qa-boot-trace');
    const style = sheet ? getComputedStyle(sheet) : null;
    const animations = [...(sheet?.getAnimations() || []), ...(edge?.parentElement?.parentElement?.getAnimations() || [])];
    const sheetControls = sheet ? [...sheet.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')]
      .filter(node => {
        if (node.matches(':disabled') || node.tabIndex < 0 || node.closest('[inert],[hidden]')) return false;
        // Closed details can retain descendant layout boxes. Native Tab admits
        // only their first summary, including that summary's own controls.
        for (let parent = node.parentElement; parent && sheet.contains(parent); parent = parent.parentElement) {
          if (!parent.matches('details:not([open])')) continue;
          const summary = [...parent.children].find(child => child.tagName === 'SUMMARY');
          if (!summary?.contains(node)) return false;
        }
        if (node.tagName === 'SUMMARY' && node.parentElement?.tagName === 'DETAILS'
          && !node.hasAttribute('tabindex')
          && [...node.parentElement.children].find(child => child.tagName === 'SUMMARY') !== node) return false;
        const bounds = node.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 && getComputedStyle(node).visibility === 'visible';
      }).sort((left, right) => {
        const leftOrder = left.tabIndex > 0 ? left.tabIndex : Infinity;
        const rightOrder = right.tabIndex > 0 ? right.tabIndex : Infinity;
        return leftOrder === rightOrder ? 0 : leftOrder-rightOrder;
      }) : [];
    const focusedControlIndex = sheetControls.indexOf(document.activeElement);
    const ledger = document.querySelector('.sites-sites-workspace[data-mode="ledger"] .zen-ledger');
    const readingOwner = sheet?.closest('.zen-garden-pathways');
    const safeRight = readingOwner ? Number.parseFloat(getComputedStyle(readingOwner).getPropertyValue('--zen-garden-text-safe-right')) : null;
    const ledgerFrame = rect(ledger);
    const ledgerInset = ledger ? Number.parseFloat(getComputedStyle(ledger).getPropertyValue('--zen-ledger-inset')) : null;
    const clipFrames = ['.zen-garden-sheet-viewport', '#zen-garden-ledger', '.zen-garden-threshold-viewport']
      .map(selector => {
        const node = document.querySelector(selector);
        if (!node) throw new Error('QA_PRESSURE_RAIL_PRESENTATION_CLIP_MISSING:'+selector);
        return { owner:selector, scrollTop:node.scrollTop, scrollLeft:node.scrollLeft };
      });
    return {
      atMs: performance.now(), visibility: document.visibilityState,
      activeTab: document.querySelector('[data-dashboard-active-tab]')?.dataset.dashboardActiveTab,
      mode: stage?.dataset.gardenMode, layoutMode: stage?.closest('[data-ui-layout]')?.dataset.uiLayout,
      sitesMode: document.querySelector('.sites-sites-workspace')?.dataset.mode ?? null,
      notebookDomain: document.querySelector('.sites-notebook-heading h2')?.textContent?.trim() ?? null,
      stage: rect(stage), pond: rect(document.querySelector('[data-main-presentation-surface="pond"]')),
      rail: rect(rail), graph: rect(document.querySelector('[data-main-presentation-surface="pressure-rail"]')),
      sheetViewport: rect(document.querySelector('.zen-garden-sheet-viewport')),
      clipFrames,
      sheetControlCount: sheetControls.length,
      ledgerReading: ledger ? { ready: readingOwner?.dataset.readingReady === 'true', safeRight,
        rowCount: ledger.querySelectorAll('.zen-ledger__row').length,
        inkLeft: ledgerFrame.x + ledgerInset, inkRight: ledgerFrame.right - safeRight - ledgerInset,
        controls: sheetControls.filter(node => ledger.contains(node)).map(rect),
        menuOpen: ledger.querySelector('[data-sites-ledger-menu]')?.open === true,
        menuFocused: document.activeElement?.matches('[data-sites-ledger-menu-trigger]') === true } : null,
      globalCapInputFocused: document.activeElement?.matches('.zen-sites-global-cap input[type="number"]') === true,
      lastSheetControl: sheetControls.length === 0 ? null : {
        tag:sheetControls.at(-1).tagName, id:sheetControls.at(-1).id,
        role:sheetControls.at(-1).getAttribute('role'),
      },
      sheetFocus: focusedControlIndex < 0 ? null : { index:focusedControlIndex,
        count:sheetControls.length, last:focusedControlIndex === sheetControls.length-1,
        bounds:rect(document.activeElement) },
      sitesScrollTop: document.getElementById('sites-tab')?.scrollTop ?? null,
      sheet: sheet ? { ...rect(sheet), inert: sheet.inert,
        opaque: opaquePaper(style), paint: { opacity:style.opacity,
          backgroundImage:style.backgroundImage, backgroundColor:style.backgroundColor } } : null,
      panelLineX: stage && line ? stage.getBoundingClientRect().left+line.x1.baseVal.value : null,
      edge: edge ? { ...rect(edge), expanded: edge.getAttribute('aria-expanded') === 'true',
        busy: edge.getAttribute('aria-busy') === 'true', focused: document.activeElement === edge,
        focusVisible: edge.matches(':focus-visible') } : null,
      dragging: stage?.dataset.sheetDragging === 'true',
      edgeInputEvents:edgeInputEvents.slice(),
      pondPresentationReady: stage?.dataset.pondPresentationReady === 'true',
      animationsActive: animations.some(animation => animation.playState === 'running'),
      segments: faces.map(node => {
        const action = node.querySelector('[data-testid="pressure-domain-action"]');
        return { domain: node.dataset.domain, pressureShare: Number(node.dataset.pressureShare), width: rect(node).width,
          hovered: node.dataset.hovered === 'true', revealed: action?.dataset.revealed === 'true',
          focused: document.activeElement === action, focusVisible: action?.matches(':focus-visible') === true };
      }),
      selectedDomain: selected[0]?.dataset.domain ?? null,
      readout: rect(document.querySelector('[data-testid="pressure-action-drawer"]')),
      bonsai: { sameCanvas: document.querySelector(bonsaiSelector) === bonsaiCanvas && bonsaiCanvas.isConnected,
        canvasCount: document.querySelectorAll(bonsaiSelector).length, replaced, visible: visible(bonsaiCanvas) },
      pondCanvas: { sameCanvas: document.querySelector(pondSelector) === pondCanvas && pondCanvas.isConnected,
        visible: visible(pondCanvas) },
      traceMode: rawTraceMode === null ? 'full' : rawTraceMode,
      traceIndex: last?.index ?? null, traceSessionId: last?.sessionId ?? null,
      pondResumeAck: resumeEntry ? { index: resumeEntry.index, sceneCommitKey: resumeEntry.details.sceneCommitKey,
        reason: resumeEntry.event === 'pond_controller:retained_scene_ack_replayed'
          ? 'retained_presentation_scene_ack_replay' : 'worker_presentation_scene_frame_ack' } : null,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  };
  const probe = {
    read,
    async metrics() {
      const value = await globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG.metrics();
      if (value?.error || !Number.isFinite(value?.sampleFrames)) throw new Error('QA_PRESSURE_RAIL_POND_METRICS_INVALID');
      return { ...read(), sampleFrames: value.sampleFrames, koiRender: value.mainMetrics?.koiRender };
    },
    dispose() {
      observer.disconnect();
      edgeInputTypes.forEach(type => window.removeEventListener(type, observeEdgeInput, true));
      if (globalThis[key] !== probe) throw new Error('QA_PRESSURE_RAIL_PROBE_OWNERSHIP_LOST');
      delete globalThis[key];
    },
  };
  globalThis[key] = probe;
  return read();
}

// Native input stays on the run-owned page. The probe only observes DOM,
// retained canvas identity and existing runtime metrics/accepted ACK traces.
export async function runDashboardPressureRailJourney({ harness, page, signal, capture, record }) {
  const samples = [], screenshots = {}, fishFocusSamples = [], pondResumeSamples = [];
  let step = 'install', installed = false, baseline = null, primaryError = null;
  const dom = expression => evaluate(harness.cdp, page.sessionId, expression, { timeoutMs: 25000 });
  const call = method => dom(`globalThis[${JSON.stringify(PROBE_KEY)}][${JSON.stringify(method)}]()`);
  const read = () => call('read');
  const until = async (predicate, metrics = false) => {
    const deadline = Date.now()+20000;
    let state;
    while (Date.now() < deadline) {
      signal?.throwIfAborted(); state = await call(metrics ? 'metrics' : 'read');
      if (baseline) { requirePressureRailSample(baseline, state); requirePressureRailClipSample(state); }
      if (predicate(state)) return state;
      await sleep(30);
    }
    const failure = new Error('QA_PRESSURE_RAIL_JOURNEY_TIMEOUT:'+step);
    failure.sample = state; throw failure;
  };
  const note = state => {
    requirePressureRailSample(baseline, state); requirePressureRailClipSample(state);
    samples.push({ step, state }); return state;
  };
  const settled = (mode, view = null, domain = null) => until(state => state.mode === mode
    && state.activeTab === (mode === 'pond' ? 'main' : 'sites') && !state.edge?.busy
    && !state.dragging && !state.animationsActive && (view === null || state.sitesMode === view)
    && (domain === null || state.notebookDomain === domain));
  const pointFor = selector => dom(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node || node.disabled || node.closest('[inert],[hidden]')) throw new Error('QA_PRESSURE_RAIL_CONTROL_UNAVAILABLE');
    const r = node.getBoundingClientRect(), point = { x:r.x+r.width/2, y:r.y+r.height/2 };
    if (r.width <= 0 || r.height <= 0 || !node.contains(document.elementFromPoint(point.x, point.y))) {
      throw new Error('QA_PRESSURE_RAIL_CONTROL_OCCLUDED');
    }
    return point;
  })()`);
  const move = (point, buttons = 0) => harness.cdp.send('Input.dispatchMouseEvent',
    { type:'mouseMoved', ...point, button:buttons === 1 ? 'left' : 'none', buttons }, page.sessionId);
  const mouse = (type, point, button = 'left') => harness.cdp.send('Input.dispatchMouseEvent', {
    type, ...point, button, buttons:type === 'mousePressed' ? (button === 'back' ? 8 : 1) : 0, clickCount:1,
  }, page.sessionId);
  const click = async selector => {
    const point = await pointFor(selector);
    await move(point); await mouse('mousePressed', point); await mouse('mouseReleased', point);
  };
  const key = async (keyValue, code, virtualCode) => {
    for (const type of ['keyDown','keyUp']) await harness.cdp.send('Input.dispatchKeyEvent',
      { type, key:keyValue, code, windowsVirtualKeyCode:virtualCode }, page.sessionId);
  };
  const faceSelector = domain => `[data-pressure-target="site"][data-domain="${domain}"]`;
  const actionSelector = domain => `[data-testid="pressure-domain-action"][data-domain="${domain}"]`;
  const checkWorkspace = (state, mode, view = null, domain = null) =>
    requirePressureRailWorkspaceSample(note(state), { mode, view, domain });
  const awaitPondResume = async before => {
    const state = await until(value => value.mode === 'pond' && value.activeTab === 'main' && !value.edge?.busy
      && !value.dragging && !value.animationsActive && value.pondCanvas?.visible
      && value.sampleFrames > before.sampleFrames
      && (value.traceMode !== 'full' || value.pondResumeAck?.index > before.traceIndex), true);
    pondResumeSamples.push({ step, receipt:requirePressureRailPondResumeSample(before, state) });
    return checkWorkspace(state, 'pond');
  };
  const readHoverFishFocus = async domain => {
    const state = await until(value => value.koiRender?.focusHoveredCount === 1
      && value.koiRender?.focusSelectedCount === 0 && value.koiRender?.focusGlowVisibleCount >= 1, true);
    fishFocusSamples.push({ step, domain, focusHoveredCount:state.koiRender.focusHoveredCount,
      focusSelectedCount:state.koiRender.focusSelectedCount, focusGlowVisibleCount:state.koiRender.focusGlowVisibleCount });
  };
  const dragEdge = async (distance, targetMode) => {
    const before = await call('metrics'), start = await pointFor('.zen-garden-paper-edge');
    await move(start); await mouse('mousePressed', start);
    for (let index = 1; index <= 4; index += 1) await move({ x:start.x, y:start.y+distance*index/4 }, 1);
    const prepared = await read();
    note(prepared);
    if (prepared.mode !== before.mode) throw new Error('QA_PRESSURE_RAIL_DRAG_COMMITTED_BEFORE_RELEASE');
    if (before.mode === 'pathways') {
      if (!prepared.pondPresentationReady && Math.abs(prepared.sheet.y-prepared.sheetViewport.y) > 0.75) {
        throw new Error('QA_PRESSURE_RAIL_CLOSE_DRAG_EXPOSED_POND_BEFORE_ACK');
      }
      // Keep the real mouse button pressed while the canonical current-scene
      // fence prepares Pond. Neither a timer nor release authorizes blank paint.
      const ready = await until(value => value.pondPresentationReady);
      note(ready);
      if (ready.mode !== before.mode) throw new Error('QA_PRESSURE_RAIL_DRAG_COMMITTED_BEFORE_RELEASE');
      // Only an admitted pointer move takes over the painted settling sheet.
      await move({ x:start.x, y:start.y+distance }, 1);
    }
    const dragging = await until(value => value.dragging);
    note(dragging);
    if (dragging.mode !== before.mode) throw new Error('QA_PRESSURE_RAIL_DRAG_COMMITTED_BEFORE_RELEASE');
    await mouse('mouseReleased', { x:start.x, y:start.y+distance });
    if (targetMode === 'pond') return awaitPondResume(before);
    return checkWorkspace(await settled(targetMode, targetMode === 'pathways' ? 'ledger' : null),
      targetMode, targetMode === 'pathways' ? 'ledger' : null);
  };
  const focusHeldSheet = async () => {
    const start = await pointFor('.zen-garden-paper-edge');
    await move(start); await mouse('mousePressed', start);
    await move({ x:start.x, y:start.y+48 }, 1);
    await until(state => state.pondPresentationReady);
    await move({ x:start.x, y:start.y+48 }, 1);
    await move({ x:start.x, y:start.y+144 }, 1);
    let state = note(await until(value => value.dragging && value.mode === 'pathways'
      && value.sheet.y-value.sheetViewport.y > 16));
    // Holding the real edge keeps the paper partly translated while native Tab
    // reaches controls near its lower edge. Only Sites may scroll to reveal them.
    for (let count = 0; count < 80 && !state.sheetFocus?.last; count += 1) {
      await key('Tab','Tab',9);
      state = await read();
      requirePressureRailSample(baseline, state); requirePressureRailClipSample(state);
    }
    if (!state.sheetFocus?.last || !state.dragging || state.mode !== 'pathways') {
      throw new Error('QA_PRESSURE_RAIL_HELD_SHEET_KEYBOARD_FOCUS_UNREACHABLE');
    }
    note(state);
    screenshots.heldFocus = await capture('held-focus');
    // Return below the commit distance before release, preserving the ledger.
    await mouse('mouseReleased', { x:start.x, y:start.y+20 });
    return checkWorkspace(await settled('pathways','ledger'), 'pathways','ledger');
  };
  try {
    baseline = await dom(`(${installPressureRailProbe.toString()})(${JSON.stringify(PROBE_KEY)})`); installed = true;
    step = 'idle';
    if (baseline.segments.length < 2 || baseline.segments.some(segment => segment.revealed)) {
      throw new Error('QA_PRESSURE_RAIL_INITIAL_STATE_INVALID');
    }
    checkWorkspace(baseline, 'pond'); screenshots.idle = await capture('idle');
    const [first,second] = baseline.segments;
    step = 'favicon-hover';
    await move(await pointFor(faceSelector(first.domain)));
    note(await until(state => state.segments[0].hovered && state.segments[0].revealed));
    await readHoverFishFocus(first.domain); screenshots.hover = await capture('hover');
    step = 'favicon-intel';
    await click(actionSelector(first.domain));
    checkWorkspace(await settled('pathways','notebook',first.domain), 'pathways','notebook',first.domain);
    screenshots.intel = await capture('intel');
    step = 'escape-ledger'; await key('Escape','Escape',27);
    checkWorkspace(await settled('pathways','ledger'), 'pathways','ledger');
    note(requirePressureRailLedgerReading(await until(state => state.ledgerReading?.ready && state.ledgerReading.rowCount === 2)));
    screenshots.ledger = await capture('ledger');
    step = 'ledger-management';
    await click('[data-sites-ledger-menu-trigger]');
    note(requirePressureRailLedgerReading(await until(state => state.ledgerReading?.menuOpen)));
    screenshots.ledgerMenu = await capture('ledger-menu');
    await click('[data-sites-ledger-menu] [data-sites-global-cap-trigger]');
    await until(state => state.mode === 'pathways' && !state.ledgerReading?.menuOpen
      && state.sitesMode === 'ledger' && state.globalCapInputFocused);
    await click('.zen-sites-global-cap .sites-cap-inline-editor button[type="button"]');
    note(requirePressureRailLedgerReading(await until(state => state.ledgerReading?.menuFocused && !state.ledgerReading.menuOpen)));
    step = 'escape-pond';
    const beforeEscape = await call('metrics'); await key('Escape','Escape',27);
    await awaitPondResume(beforeEscape); screenshots.escapePond = await capture('escape-pond');
    step = 'keyboard-favicon';
    let keyboard = await read();
    for (let count = 0; count < 80 && !keyboard.segments[1].focused; count += 1) {
      await key('Tab','Tab',9); keyboard = await read();
    }
    if (!keyboard.segments[1].focused) {
      throw new Error('QA_PRESSURE_RAIL_KEYBOARD_FAVICON_UNREACHABLE');
    }
    keyboard = await until(state => state.segments[1].focused && state.segments[1].focusVisible && state.segments[1].revealed);
    note(keyboard); await readHoverFishFocus(second.domain); await key(' ','Space',32);
    checkWorkspace(await settled('pathways','notebook',second.domain), 'pathways','notebook',second.domain);
    screenshots.keyboardIntel = await capture('keyboard-intel');
    step = 'mouse-back-ledger';
    const notebook = await read(), backPoint = { x:notebook.sheetViewport.x+24, y:notebook.sheetViewport.y+48 };
    await move(backPoint); await mouse('mousePressed',backPoint,'back'); await mouse('mouseReleased',backPoint,'back');
    checkWorkspace(await settled('pathways','ledger'), 'pathways','ledger');
    step = 'drag-down-pond'; await dragEdge(96,'pond');
    step = 'drag-up-ledger'; await dragEdge(-96,'pathways'); screenshots.dragLedger = await capture('drag-ledger');
    step = 'drag-cancel-ledger';
    // A real pointer drag below the 36px commit distance restores the open sheet.
    // No synthetic pointercancel or product callback replaces native input.
    await dragEdge(20,'pathways');
    step = 'held-sheet-keyboard-focus'; await focusHeldSheet();
    step = 'final-drag-down-pond'; await dragEdge(96,'pond'); screenshots.finalPond = await capture('final-pond');
    const result = { samples, screenshots, fishFocusSamples, pondResumeSamples,
      scope:'Native CDP favicon hover/keyboard entry, direct Intel, sequential Escape, one-step mouse back, vertical edge drag/release/cancel and keyboard focus through a partly held sheet without scrolling presentation clips; unchanged quantitative allocation, full pond-cover sheet, one retained Bonsai canvas and accepted Pond resume with Worker progression on one isolated page. Transparent crown overlap is allowed. Images and CSS motion are observations, not FPS, physical input latency or exact compositor-frame evidence.' };
    await record(result); return result;
  } catch (error) {
    primaryError = error;
    const diagnostic = { step, samples, screenshots, fishFocusSamples, pondResumeSamples, error:error.message, sample:error.sample };
    if (installed) {
      try { diagnostic.page = await read(); }
      catch (inspectionError) { diagnostic.inspectionError = inspectionError.message; }
    }
    error.diagnostic = diagnostic; await record(diagnostic); throw error;
  } finally {
    if (installed) {
      try { await call('dispose'); }
      catch (cleanupError) { throw new AggregateError(primaryError ? [primaryError,cleanupError] : [cleanupError],
        'QA_PRESSURE_RAIL_PROBE_CLEANUP_FAILED', { cause:primaryError || cleanupError }); }
    }
  }
}
