const NORMAL_WINDOW_STATE = 'normal';
const MINIMIZED_WINDOW_STATE = 'minimized';
const CWS_WINDOW_STATES = new Set([
  NORMAL_WINDOW_STATE,
  MINIMIZED_WINDOW_STATE,
  'maximized',
  'fullscreen',
]);

function normalizeWindowId(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeWindowState(value) {
  return CWS_WINDOW_STATES.has(value) ? value : null;
}

export async function presentCwsVisualTarget(cdp, {
  targetId,
  sessionId,
} = {}) {
  if (typeof targetId !== 'string' || targetId.length === 0) {
    throw new Error('CWS_VISUAL_PRESENTATION_TARGET_ID_REQUIRED');
  }
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('CWS_VISUAL_PRESENTATION_SESSION_ID_REQUIRED');
  }

  const windowInfo = await cdp.send('Browser.getWindowForTarget', { targetId });
  const windowId = normalizeWindowId(windowInfo?.windowId);
  if (windowId === null) {
    throw new Error('CWS_VISUAL_PRESENTATION_WINDOW_ID_INVALID');
  }

  const initialWindowState = normalizeWindowState(windowInfo?.bounds?.windowState);
  if (initialWindowState === null) {
    throw new Error('CWS_VISUAL_PRESENTATION_WINDOW_STATE_INVALID');
  }
  const restored = initialWindowState === MINIMIZED_WINDOW_STATE;
  let finalWindowState = initialWindowState;
  if (restored) {
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: NORMAL_WINDOW_STATE },
    });
    const restoredWindowInfo = await cdp.send('Browser.getWindowBounds', { windowId });
    finalWindowState = normalizeWindowState(restoredWindowInfo?.bounds?.windowState);
    if (finalWindowState === null) {
      throw new Error('CWS_VISUAL_PRESENTATION_FINAL_WINDOW_STATE_INVALID');
    }
    if (finalWindowState === MINIMIZED_WINDOW_STATE) {
      throw new Error('CWS_VISUAL_PRESENTATION_WINDOW_RESTORE_FAILED');
    }
  }

  await cdp.send('Target.activateTarget', { targetId });
  await cdp.send('Page.bringToFront', {}, sessionId);

  return {
    windowId,
    initialWindowState,
    finalWindowState,
    restored,
  };
}
