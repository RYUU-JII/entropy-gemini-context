import { useEffect, useRef } from 'react';
import { retainDashboardThemeRenderRuntime } from '@/themes/core/runtime/dashboardRenderRuntime.js';
import { createBootIdleAdmission } from '../bootstrap/bootIdleAdmission.js';
import { isZenGardenRoute } from '../workspaces/garden/gardenRouteFamily.js';

export function useDashboardRenderRuntime({ themeId, bootShellDismissed, activeTabId, ambientPresentation }) {
  const lifetime = useRef(null);
  useEffect(() => {
    const promise = retainDashboardThemeRenderRuntime(themeId);
    lifetime.current = promise;
    void promise.catch(error => console.error('[DashboardRenderRuntime]', error));
    return () => {
      lifetime.current = null;
      void promise.then(handle => handle.release()).catch(error => console.error('[DashboardRenderRuntime][release]', error));
    };
  }, [themeId]);
  useEffect(() => {
    // GPU construction is synchronous even in a Worker. Do not stall the
    // visible Main Pond/Bonsai loops by speculating on their shared thread.
    const gardenSceneActive = isZenGardenRoute(themeId, activeTabId);
    if (!bootShellDismissed || activeTabId === 'main' || gardenSceneActive || !ambientPresentation || ambientPresentation.themeId !== themeId) return undefined;
    const controller = new AbortController();
    const admission = activeTabId === 'tools' ? null : createBootIdleAdmission({ signal: controller.signal });
    const pendingLifetime = lifetime.current;
    void (async () => {
      if (admission) {
        const admitted = await admission.wait({ deadlineMs: performance.now() + 10000 });
        if (admitted.cancelled || admitted.timedOut) return;
      }
      const handle = await pendingLifetime;
      if (controller.signal.aborted || handle.status === 'not_declared') return;
      await handle.prepare({ nightDepth: ambientPresentation.nightDepth, devicePixelRatio: window.devicePixelRatio });
    })().catch(error => { if (!controller.signal.aborted) console.error('[DashboardRenderRuntime][prepare]', error); })
      .finally(() => admission?.dispose());
    return () => controller.abort();
  }, [themeId, bootShellDismissed, activeTabId, ambientPresentation?.themeId, ambientPresentation?.nightDepth]);
}
