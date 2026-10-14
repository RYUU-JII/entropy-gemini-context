import { evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';

function inspectDevelopmentTools() {
  const hud = document.querySelector('.dashboard-development-hud');
  const consoleFrame = document.querySelector('.console-frame');
  if (!hud || !consoleFrame) return null;
  const rect = node => {
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const panel = hud.querySelector(':scope > aside');
  const progression = panel?.querySelector('[data-entropy-debug-signature="ENTROPY_PROGRESSION_UNLOCK_DEBUG_DEV"]');
  const slider = panel?.querySelector('input[type="range"]');
  const close = panel?.querySelector('button');
  return {
    viewport: { width: innerWidth, height: innerHeight },
    console: rect(consoleFrame), panel: panel ? rect(panel) : null,
    launcherFocused: document.activeElement === hud.querySelector(':scope > button'),
    closeFocused: Boolean(close && document.activeElement === close),
    time: slider ? { value: Number(slider.value), minimum: Number(slider.min), step: Number(slider.step),
      label: panel.querySelector('output')?.textContent,
      custom: panel.querySelector('.zen-appearance-time-control button')?.getAttribute('aria-pressed') === 'true' } : null,
    progression: progression ? { status: progression.querySelector('[role="status"]')?.textContent,
      controls: [...progression.querySelectorAll('button[aria-pressed]')].map(button => ({
        label: button.getAttribute('aria-label'), pressed: button.getAttribute('aria-pressed'), disabled: button.disabled,
      })) } : null,
    timeOrigin: performance.timeOrigin,
  };
}

export async function runDashboardDevelopmentToolsJourney({ harness, page, signal, capture, record, settleLayout }) {
  const samples = [];
  const read = () => evaluate(harness.cdp, page.sessionId, `(${inspectDevelopmentTools.toString()})()`);
  const wait = async (predicate, stage) => {
    const deadline = Date.now() + 10_000;
    let sample;
    while (Date.now() < deadline) {
      signal?.throwIfAborted();
      sample = await read();
      if (sample && predicate(sample)) return sample;
      await sleep(50);
    }
    const error = new Error('QA_DEVELOPMENT_TOOLS_STATE_TIMEOUT:' + stage);
    error.diagnostic = sample;
    throw error;
  };
  const click = async selector => {
    const point = await evaluate(harness.cdp, page.sessionId, `(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node || node.disabled) throw new Error('QA_DEVELOPMENT_TOOLS_CONTROL_UNAVAILABLE');
      const r = node.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (!node.contains(document.elementFromPoint(x, y))) throw new Error('QA_DEVELOPMENT_TOOLS_CONTROL_OCCLUDED');
      return { x, y };
    })()`);
    await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 }, page.sessionId);
    await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 }, page.sessionId);
  };
  const key = async (keyName, code, windowsVirtualKeyCode) => {
    for (const type of ['keyDown', 'keyUp']) {
      await harness.cdp.send('Input.dispatchKeyEvent', { type, key: keyName, code, windowsVirtualKeyCode }, page.sessionId);
    }
  };
  const requireOutsideSpace = (before, sample) => {
    const p = sample.panel, c = sample.console;
    if (!p || p.width <= 0 || p.height <= 0 || p.x < 0 || p.y < 0
      || p.bottom > sample.viewport.height || p.right > c.x - 15
      || c.right > sample.viewport.width || c.width <= 0
      || c.x <= before.console.x || !sample.time || !sample.progression
      || sample.timeOrigin !== before.timeOrigin) {
      const error = new Error('QA_DEVELOPMENT_TOOLS_RESERVED_SPACE_FAILED');
      error.diagnostic = { before, sample };
      throw error;
    }
  };
  try {
    const before = await wait(sample => !sample.panel, 'collapsed');
    samples.push({ stage: 'collapsed', ...before, screenshot: await capture('collapsed') });
    await click('.dashboard-development-hud > button');
    const opened = await wait(sample => sample.panel && sample.closeFocused && sample.progression?.status
      && sample.progression.controls.length > 0 && sample.progression.controls.every(control => !control.disabled), 'opened');
    requireOutsideSpace(before, opened);
    const openedFrame = await settleLayout();
    samples.push({ stage: 'opened', ...opened, sceneFrame: openedFrame, screenshot: await capture('opened') });

    // Follow real time first, then exercise the native range input. Moving the
    // range must select custom appearance time without changing progression.
    if (opened.time.custom) await click('.zen-appearance-time-control button');
    await wait(sample => sample.time?.custom === false, 'realtime');
    await click('.zen-appearance-time-control input[type="range"]');
    await key('Home', 'Home', 36);
    await key('ArrowRight', 'ArrowRight', 39);
    const expectedMinutes = opened.time.minimum + opened.time.step;
    const timeChanged = await wait(sample => sample.time?.custom && sample.time.value === expectedMinutes, 'custom_time');
    if (JSON.stringify(timeChanged.progression) !== JSON.stringify(opened.progression)) {
      throw new Error('QA_DEVELOPMENT_TOOLS_APPEARANCE_CHANGED_PROGRESSION');
    }
    samples.push({ stage: 'custom_time', ...timeChanged });
    await key('Escape', 'Escape', 27);
    const closed = await wait(sample => !sample.panel && sample.launcherFocused
      && Math.abs(sample.console.width - before.console.width) < 0.5
      && Math.abs(sample.console.x - before.console.x) < 0.5, 'escape_closed');
    samples.push({ stage: 'escape_closed', ...closed, sceneFrame: await settleLayout() });

    await click('.dashboard-development-hud > button');
    const reopened = await wait(sample => sample.panel && sample.closeFocused, 'reopened');
    requireOutsideSpace(before, reopened);
    await settleLayout();
    if (reopened.time.value !== expectedMinutes || !reopened.time.custom) throw new Error('QA_DEVELOPMENT_TOOLS_TIME_NOT_RETAINED');
    await click('.dashboard-development-hud > aside > div button');
    samples.push({ stage: 'button_closed', ...await wait(sample => !sample.panel && sample.launcherFocused, 'button_closed'),
      sceneFrame: await settleLayout() });
    const result = { completed: true, input: 'native_cdp', samples };
    await record(result);
    return result;
  } catch (error) {
    await record({ completed: false, samples, error: { message: error.message, diagnostic: error.diagnostic } });
    throw error;
  }
}
