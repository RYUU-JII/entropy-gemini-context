import React from 'react';
import { Toggle as ThemeToggle } from './theme/Toggle/index.jsx';

/**
 * Shared UI Toggle
 * 
 * Delegates rendering to the Theme System Toggle implementation.
 */
export function UiToggle(props) {
  return <ThemeToggle {...props} />;
}
