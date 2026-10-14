export function readDevicePixelRatio(browserWindow = window) {
  const ratio = browserWindow.devicePixelRatio;
  if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('RENDER_DEVICE_PIXEL_RATIO_INVALID');
  return ratio;
}

// CSS geometry observation does not detect every monitor/zoom DPR transition.
// Each host owns its subscription; no application-wide quality state is stored.
export function observeDevicePixelRatio({ browserWindow = window, onChange }) {
  if (typeof browserWindow.matchMedia !== 'function' || typeof onChange !== 'function') {
    throw new Error('RENDER_DEVICE_PIXEL_RATIO_OBSERVER_REQUIRED');
  }
  let ratio = readDevicePixelRatio(browserWindow);
  let query;
  let disposed = false;
  const changed = () => {
    if (disposed) return;
    const next = readDevicePixelRatio(browserWindow);
    if (next === ratio) return;
    query.removeEventListener('change', changed);
    ratio = next;
    arm();
    onChange(ratio);
  };
  const arm = () => {
    query = browserWindow.matchMedia(`(resolution: ${ratio}dppx)`);
    query.addEventListener('change', changed);
  };
  arm();
  browserWindow.addEventListener('resize', changed);
  return () => {
    if (disposed) return;
    disposed = true;
    query.removeEventListener('change', changed);
    browserWindow.removeEventListener('resize', changed);
  };
}
