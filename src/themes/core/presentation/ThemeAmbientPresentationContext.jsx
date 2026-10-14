import React, { createContext, useContext } from 'react';

const ThemeAmbientPresentationContext = createContext(null);

export function ThemeAmbientPresentationProvider({ children, value }) {
  return (
    <ThemeAmbientPresentationContext.Provider value={value}>
      {children}
    </ThemeAmbientPresentationContext.Provider>
  );
}

export function useThemeAmbientPresentation() {
  return useContext(ThemeAmbientPresentationContext);
}
