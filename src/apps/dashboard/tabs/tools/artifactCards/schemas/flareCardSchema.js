import { buildSentinelFlareCard } from '../buildSentinelFlareCard.jsx';
import { extendFlareDerivedState } from '../derivedState.js';
import { buildFlareVisualState } from '../visualStates.js';

export const flareCardSchema = Object.freeze({
  id: 'flare',
  extendDerivedState: extendFlareDerivedState,
  build: buildSentinelFlareCard,
  buildVisualState: buildFlareVisualState,
});
