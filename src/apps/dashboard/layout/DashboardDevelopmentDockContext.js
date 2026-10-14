import { createContext, useContext } from 'react';

// Placement only. The Bonsai runtime retains its debug state and commands.
export const DashboardDevelopmentDockContext = createContext(null);
export const useDashboardDevelopmentDock = () => useContext(DashboardDevelopmentDockContext);
