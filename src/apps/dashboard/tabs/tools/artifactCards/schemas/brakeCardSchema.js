import { buildBrakeCard } from '../buildBrakeCard.jsx';
import { extendBrakeDerivedState } from '../derivedState.js';
import { buildBrakeVisualState } from '../visualStates.js';

export const brakeCardSchema = Object.freeze({
  id: 'brake',
  extendDerivedState: extendBrakeDerivedState,
  build: buildBrakeCard,
  buildVisualState: buildBrakeVisualState,
});
