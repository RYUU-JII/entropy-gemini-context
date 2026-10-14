import { buildBarrierCard } from '../buildBarrierCard.jsx';
import { extendBarrierDerivedState } from '../derivedState.js';
import { buildBarrierVisualState } from '../visualStates.js';

export const barrierCardSchema = Object.freeze({
  id: 'barrier',
  extendDerivedState: extendBarrierDerivedState,
  build: buildBarrierCard,
  buildVisualState: buildBarrierVisualState,
});
