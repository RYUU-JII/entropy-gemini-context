import React, { createContext, useContext } from 'react';

const ThemeTemporalAuthorityContext = createContext(null);

export function ThemeTemporalAuthorityProvider({ children, value }) {
  return (
    <ThemeTemporalAuthorityContext.Provider value={value}>
      {children}
    </ThemeTemporalAuthorityContext.Provider>
  );
}

export function useThemeTemporalAuthority() {
  return useContext(ThemeTemporalAuthorityContext);
}
