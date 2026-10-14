import { DEFAULT_KOI_TUNING } from '../../plugins/zen/pond/model/koi/constants.js';

export function createDefaultSignalTuning() {
  return {
    ...DEFAULT_KOI_TUNING,
    physics: { ...DEFAULT_KOI_TUNING.physics },
  };
}
