let clseAlertOverlayPromise = null;

export function loadCLSEAlertOverlay() {
  clseAlertOverlayPromise ||= import('./CLSEAlertOverlay.js')
    .catch((error) => {
      clseAlertOverlayPromise = null;
      throw error;
    });
  return clseAlertOverlayPromise;
}

export function resetCLSEAlertOverlayLoaderForTests() {
  clseAlertOverlayPromise = null;
}
