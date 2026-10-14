import { useLayoutEffect, useState } from 'react';
import { observeDevicePixelRatio, readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';

export function useDevicePixelRatio() {
  const [ratio, setRatio] = useState(() => readDevicePixelRatio());
  useLayoutEffect(() => {
    const stop = observeDevicePixelRatio({ onChange: setRatio });
    setRatio(readDevicePixelRatio());
    return stop;
  }, []);
  return ratio;
}
