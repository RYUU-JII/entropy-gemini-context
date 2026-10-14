import { buildVeilCard } from '../buildVeilCard.jsx';
import { extendVeilDerivedState } from '../derivedState.js';
import { buildVeilVisualState } from '../visualStates.js';

export const veilCardSchema = Object.freeze({
  id: 'veil',
  extendDerivedState: extendVeilDerivedState,
  build: buildVeilCard,
  buildVisualState: buildVeilVisualState,
});
