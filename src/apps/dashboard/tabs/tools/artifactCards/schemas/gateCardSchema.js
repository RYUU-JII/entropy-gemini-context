import { buildGateCard } from '../buildGateCard.jsx';
import { extendGateDerivedState } from '../derivedState.js';
import { buildGateVisualState } from '../visualStates.js';

export const gateCardSchema = Object.freeze({
  id: 'gate',
  extendDerivedState: extendGateDerivedState,
  build: buildGateCard,
  buildVisualState: buildGateVisualState,
});
