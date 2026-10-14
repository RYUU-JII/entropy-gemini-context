import { buildLensCard } from '../buildLensCard.jsx';
import { extendLensDerivedState } from '../derivedState.js';
import { buildLensVisualState } from '../visualStates.js';

export const lensCardSchema = Object.freeze({
  id: 'lens',
  extendDerivedState: extendLensDerivedState,
  build: buildLensCard,
  buildVisualState: buildLensVisualState,
});
