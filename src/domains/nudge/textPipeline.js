import TextManager from './textManager.js';
import TextShuffleManager from './textShuffleManager.js';
import { requireTextRhythmRuntimeProfile } from '../settings/config/textRhythmProfile.js';
import { syncFrictionTextTargetStylesForHostname } from './visual/styleInjection.js';

const TextPipeline = {
  update(filters) {
    const textRhythm = filters.textRhythm;
    const textShadow = filters.textShadow;

    const textRhythmActive = !!(textRhythm && textRhythm.isActive);
    const shadowActive = !!(textShadow && textShadow.isActive);

    const isActive = textRhythmActive || shadowActive;
    if (!isActive) {
      this.remove();
      return;
    }

    syncFrictionTextTargetStylesForHostname(window.location?.hostname || '');
    TextManager.update(filters);

    const profile = textRhythmActive
      ? requireTextRhythmRuntimeProfile(textRhythm.value)
      : null;
    if (profile?.shuffle?.enabled) {
      TextShuffleManager.update(profile.shuffle);
    } else {
      TextShuffleManager.disable();
    }
  },

  remove() {
    TextManager.remove();
    TextShuffleManager.disable();
  },
};

export default TextPipeline;
