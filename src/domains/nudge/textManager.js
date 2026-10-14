import { ROOT_ATTRS, removeRootAttribute, setRootAttribute, setRootVar } from './core/index.js';
import { getTextFilterVars, ROOT_TEXT_VAR_NAMES } from '../../lib/filterCssVars.js';

const TextManager = {
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

    const textVars = getTextFilterVars(filters);

    if (textRhythmActive) {
      setRootVar(ROOT_TEXT_VAR_NAMES.textBlur, textVars[ROOT_TEXT_VAR_NAMES.textBlur]);
      setRootVar(ROOT_TEXT_VAR_NAMES.textOpacity, textVars[ROOT_TEXT_VAR_NAMES.textOpacity]);
      setRootAttribute(ROOT_ATTRS.TEXT_RHYTHM, '1');
    } else {
      removeRootAttribute(ROOT_ATTRS.TEXT_RHYTHM);
    }

    if (shadowActive) {
      setRootVar(ROOT_TEXT_VAR_NAMES.textShadow, textVars[ROOT_TEXT_VAR_NAMES.textShadow]);
      setRootAttribute(ROOT_ATTRS.TEXT_SHADOW, '1');
    } else {
      removeRootAttribute(ROOT_ATTRS.TEXT_SHADOW);
    }

    if (textRhythmActive || shadowActive) setRootAttribute(ROOT_ATTRS.TEXT_ACTIVE, '1');
    else removeRootAttribute(ROOT_ATTRS.TEXT_ACTIVE);

  },

  remove() {
    removeRootAttribute(ROOT_ATTRS.TEXT_RHYTHM);
    removeRootAttribute(ROOT_ATTRS.TEXT_SHADOW);
    removeRootAttribute(ROOT_ATTRS.TEXT_ACTIVE);
  },
};

export default TextManager;
