import React from 'react';

import { useZenAppPetalSourceStore } from '@/themes/plugins/zen/api/petalSource.js';
import { ZenAppPetalLayer } from '@/themes/plugins/zen/api/petalField.js';

export default function ZenAppPetalHost({
  enabled,
  solarLocationProfile,
  environmentMode,
  weatherAuthority,
  presentation,
}) {
  const sourceSignal = useZenAppPetalSourceStore((state) => state.sourceSignal);
  return (
    <ZenAppPetalLayer
      enabled={enabled}
      sourceSignal={sourceSignal}
      solarLocationProfile={solarLocationProfile}
      environmentMode={environmentMode}
      weatherAuthority={weatherAuthority}
      presentation={presentation}
    />
  );
}
