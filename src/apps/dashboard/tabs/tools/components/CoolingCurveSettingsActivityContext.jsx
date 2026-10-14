import React, { createContext, useContext } from 'react';

// The gallery's existing activity owner parks its retained settings controls.
const CoolingCurveSettingsActivityContext = createContext(null);

export function CoolingCurveSettingsActivityProvider({ isActive, children }) {
  if (typeof isActive !== 'boolean') throw new Error('COOLING_CURVE_SETTINGS_ACTIVITY_REQUIRED');
  return <CoolingCurveSettingsActivityContext.Provider value={isActive}>{children}</CoolingCurveSettingsActivityContext.Provider>;
}

export function useCoolingCurveSettingsActivity() {
  const isActive = useContext(CoolingCurveSettingsActivityContext);
  if (typeof isActive !== 'boolean') throw new Error('COOLING_CURVE_SETTINGS_ACTIVITY_REQUIRED');
  return isActive;
}
