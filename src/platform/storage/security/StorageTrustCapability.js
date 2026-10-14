import { restrictChromeStorageLocalToTrustedContexts } from '../internal/chrome-storage/localArea.js';
import { restrictChromeStorageSessionToTrustedContexts } from '../internal/chrome-storage/sessionArea.js';

// This browser boundary covers all local settings and key material together.
// Content reads use authenticated, concept-specific runtime capabilities.
let initializationPromise = null;
let sessionInitializationPromise = null;

export function initializeTrustedLocalStorageAccess() {
  if (!initializationPromise) {
    initializationPromise = restrictChromeStorageLocalToTrustedContexts();
  }
  return initializationPromise;
}

export function initializeTrustedSessionStorageAccess() {
  if (!sessionInitializationPromise) {
    sessionInitializationPromise = restrictChromeStorageSessionToTrustedContexts();
  }
  return sessionInitializationPromise;
}
