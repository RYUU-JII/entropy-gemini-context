import { useEffect, useRef, useState } from 'react';

// First Vision may temporarily replace the requested route with Main. Keep
// only the original, unconsumed Sites launch intent, never blocked tab clicks.
export function useDashboardLaunchIntentHandoff({
  launchContext,
  themeId,
  bootUserControlReleased,
  presentationLocked,
  presentationResolved,
  registrationJourneySnapshot,
  activeTabParams,
  onTabChange,
}) {
  const [initialRequest] = useState(() => (
    themeId === 'zen'
    && launchContext.requestedTabId === 'sites'
    && launchContext.targetTabId === 'sites'
      ? { tabId: 'sites', params: launchContext.targetTabParams }
      : null
  ));
  const pendingRequestRef = useRef(initialRequest);
  const interruptedRef = useRef(false);

  useEffect(() => {
    const pendingRequest = pendingRequestRef.current;
    if (pendingRequest === null) return;
    if (themeId !== 'zen' || activeTabParams?.registrationIntent) {
      pendingRequestRef.current = null;
      return;
    }
    if (presentationLocked) {
      interruptedRef.current = true;
      return;
    }
    if (!presentationResolved || !bootUserControlReleased || registrationJourneySnapshot === null) return;
    pendingRequestRef.current = null;
    if (interruptedRef.current) {
      // The canonical navigation owner rechecks progression and accessibility.
      onTabChange(pendingRequest.tabId, pendingRequest.params);
    }
  }, [
    activeTabParams,
    bootUserControlReleased,
    onTabChange,
    presentationLocked,
    presentationResolved,
    registrationJourneySnapshot,
    themeId,
  ]);
}
