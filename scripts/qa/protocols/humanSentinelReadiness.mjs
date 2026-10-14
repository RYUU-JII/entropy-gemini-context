import { evaluate } from '../../e2e/extensionChromiumHarness.mjs';

export async function inspectHumanSentinelSurface(harness, page) {
  return evaluate(harness.cdp, page.sessionId, `(() => {
    const root = document.getElementById('friction-nudge-root');
    const shadow = root?.shadowRoot;
    const inspect = (element) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        connected: element.isConnected,
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        filter: style.filter,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        inViewport: rect.width > 0 && rect.height > 0
          && rect.right > 0 && rect.bottom > 0
          && rect.left < innerWidth && rect.top < innerHeight,
      };
    };
    return {
      documentVisibility: document.visibilityState,
      document: inspect(document.documentElement),
      body: inspect(document.body),
      root: inspect(root),
      scene: inspect(shadow?.getElementById('nudgeScene')),
      frame: inspect(shadow?.querySelector('iframe')),
      furin: inspect(shadow?.querySelector('#nudgeFurinStage svg')),
      action: inspect(shadow?.getElementById('nudgeGlobalSentinelAction')),
    };
  })()`, { timeoutMs: 2_000 });
}

function isVisible(element, requireBounds = true) {
  return element?.connected === true
    && (!requireBounds || element.inViewport === true)
    && element.display !== 'none'
    && element.visibility === 'visible'
    && element.opacity > 0;
}

// A running worker alone is not a human handoff: its actual display must exist.
export function isHumanSentinelReady({ snapshot, surface }, scope) {
  const runtime = snapshot?.snapshot;
  const diagnostics = runtime?.diagnostics;
  return snapshot?.ok === true
    && snapshot.active === true
    && diagnostics?.protocolScope === scope
    && (scope === 'site' ? diagnostics.canvasRuntimeOwner === 'host_dom' : diagnostics.workerFirstFrameReady === true)
    && diagnostics.rootConnected === true
    && surface?.documentVisibility === 'visible'
    // Fixed children can render outside zero-height html/body flow boxes.
    && [surface.document, surface.body].every((element) => isVisible(element, false))
    && [surface.root, surface.scene, scope === 'site' ? surface.furin : surface.frame].every((element) => isVisible(element))
    && (scope !== 'global' || (
      diagnostics.globalSentinelGamePhase === 'awaiting_start'
      && runtime.liveCount > 0
    ));
}
