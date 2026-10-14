import React from 'react';

import { useResolvedThemeState } from '@/themes/core/react/useResolvedThemeState.js';
import SiteDecisionWorkspace from './SiteDecisionWorkspace.jsx';

const TARGET_PANEL_VARIANTS = new Set(['standard', 'paper']);

function resolveTargetPanelVariant(themeProfile) {
  const requestedVariant = themeProfile?.sites?.targetPanelVariant;
  if (requestedVariant == null || requestedVariant === '') return 'standard';
  if (!TARGET_PANEL_VARIANTS.has(requestedVariant)) {
    throw new Error(`[TargetProtocolPanel] Unsupported target panel variant '${requestedVariant}'.`);
  }
  return requestedVariant;
}

export default function TargetProtocolPanel(props) {
  const { themeProfile } = useResolvedThemeState();
  const variant = resolveTargetPanelVariant(themeProfile) === 'paper' ? 'zen' : 'standard';
  return <SiteDecisionWorkspace {...props} variant={variant} />;
}
