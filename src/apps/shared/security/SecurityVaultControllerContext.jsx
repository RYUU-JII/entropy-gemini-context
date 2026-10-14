import React, { createContext, useContext } from 'react';

const SecurityVaultControllerContext = createContext(null);

export function SecurityVaultControllerProvider({ controller, children }) {
  return <SecurityVaultControllerContext.Provider value={controller}>{children}</SecurityVaultControllerContext.Provider>;
}

export function useSecurityVaultController() {
  const controller = useContext(SecurityVaultControllerContext);
  if (controller === null) throw new Error('SECURITY_VAULT_CONTROLLER_REQUIRED');
  return controller;
}
