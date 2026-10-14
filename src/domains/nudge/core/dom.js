import {
  removeRootAttribute,
  removeRootStyle,
  setRootAttribute,
  setRootStyle,
} from '../visual/FastStyleEngine.js';

export { setRootAttribute, removeRootAttribute };

export function setRootVar(name, value) {
  setRootStyle(name, value);
}

export function removeRootVar(name) {
  removeRootStyle(name);
}
