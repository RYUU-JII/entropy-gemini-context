import { createContext, useContext, useEffect, useState } from 'react';

const DashboardPresentationAdmissionContext = createContext(null);

export function isDashboardPresentationForeground() {
  return typeof document !== 'undefined'
    && document.hidden === false
    && document.visibilityState !== 'hidden'
    && document.hasFocus();
}

// DashboardPage observes the native foreground once. Consumers receive its
// accepted presentation snapshot; it never owns eligibility or durable claims.
export function useDashboardPresentationForeground() {
  const [foregroundActive, setForegroundActive] = useState(isDashboardPresentationForeground);
  useEffect(() => {
    const update = () => setForegroundActive(isDashboardPresentationForeground());
    update();
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return foregroundActive;
}

export function resolveDashboardPresentationAdmission({
  foregroundActive,
  bootReleased,
  firstVisionActive,
  generalCeremonyRequested,
}) {
  for (const value of [foregroundActive, bootReleased, firstVisionActive, generalCeremonyRequested]) {
    if (typeof value !== 'boolean') throw new Error('DASHBOARD_PRESENTATION_ADMISSION_INPUT_INVALID');
  }
  // A requested ordinary ceremony stays pending behind First Vision's entire
  // exact-frame/cover lifecycle. There is no second timer or durable queue.
  const generalCeremonyActive = bootReleased && !firstVisionActive && generalCeremonyRequested;
  const exclusivePresentationActive = firstVisionActive || generalCeremonyActive;
  return Object.freeze({
    foregroundActive,
    generalCeremonyActive,
    exclusivePresentationActive,
    contextualPresentationAllowed: foregroundActive && bootReleased && !exclusivePresentationActive,
  });
}

export function DashboardPresentationAdmissionProvider({ value, children }) {
  return <DashboardPresentationAdmissionContext.Provider value={value}>
    {children}
  </DashboardPresentationAdmissionContext.Provider>;
}

export function useDashboardPresentationAdmission() {
  const admission = useContext(DashboardPresentationAdmissionContext);
  if (admission === null || admission === undefined) throw new Error('DASHBOARD_PRESENTATION_ADMISSION_REQUIRED');
  return admission;
}
