import { createContext, useContext } from 'react';

export const DashboardFirstUseContext = createContext(null);

export function useDashboardFirstUse() {
  const value = useContext(DashboardFirstUseContext);
  if (value === null) throw new Error('DASHBOARD_FIRST_USE_CONTEXT_REQUIRED');
  return value;
}
