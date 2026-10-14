import { buildMemoryPurgeCard } from '../buildMemoryPurgeCard.jsx';
import { extendEchoDerivedState } from '../derivedState.js';
import { buildEchoVisualState } from '../visualStates.js';

export const echoCardSchema = Object.freeze({
  id: 'echo',
  extendDerivedState: extendEchoDerivedState,
  build: buildMemoryPurgeCard,
  buildVisualState: buildEchoVisualState,
});
