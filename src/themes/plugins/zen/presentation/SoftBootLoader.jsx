import React, { useEffect, useRef } from 'react';

import { getThemeBootPresentation } from '../../../core/boot/presentationCatalog.js';
import {
  BASE_CANVAS_SIZE,
  ZEN_ENSO_BOOT_CSS,
  createBootShellElement,
  getZenEnsoStyle,
  mountZenEnsoCanvas,
} from './ZenSoftBootShell.js';

export { createBootShellElement };

const presentation = getThemeBootPresentation('zen');

export default function ZenSoftBootLoader() {
  const canvasRef = useRef(null);
  const style = getZenEnsoStyle(presentation);

  useEffect(() => (
    mountZenEnsoCanvas(canvasRef.current, { seed: `${presentation.themeId}:react-loader` })
  ), []);

  return (
    <div className="zen-enso-boot" style={style}>
      <style>{ZEN_ENSO_BOOT_CSS}</style>
      <div className="zen-enso-boot__paper-field" />
      <div className="zen-enso-boot__wash" />
      <div className="zen-enso-boot__grain" />

      <div className="zen-enso-boot__stage">
        <div className="zen-enso-boot__enso-shell" aria-hidden="true">
          <canvas
            ref={canvasRef}
            className="zen-enso-boot__canvas"
            width={BASE_CANVAS_SIZE}
            height={BASE_CANVAS_SIZE}
          />
        </div>
      </div>
    </div>
  );
}
