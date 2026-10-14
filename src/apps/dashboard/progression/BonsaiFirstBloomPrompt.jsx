import React, { useLayoutEffect, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT } from '@/themes/plugins/zen/api/bonsaiFirstBloom.js';
import './bonsaiFirstBloomPrompt.css';

export default function BonsaiFirstBloomPrompt({
  visible = false,
  disabled = false,
  activatedMask = 0,
  error = null,
  onActivate,
  regionTargets = null,
} = {}) {
  const { t } = useAppTranslation('main');
  const overlayRef = useRef(null);
  const [projection, setProjection] = useState(null);
  useLayoutEffect(() => {
    if (!visible || regionTargets === null) return;
    const canvas = regionTargets.canvasRef.current;
    const overlay = overlayRef.current;
    if (canvas === null || overlay === null) return;
    const canvasRect = canvas.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    if (![canvasRect.width, canvasRect.height, regionTargets.canvasCssWidth, regionTargets.canvasCssHeight]
      .every(value => Number.isFinite(value) && value > 0)
      || ![canvasRect.left, canvasRect.top, overlayRect.left, overlayRect.top].every(Number.isFinite)
      || !Array.isArray(regionTargets.regions) || regionTargets.regions.length !== ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT) {
      throw new Error('BONSAI_FIRST_BLOOM_TARGET_PROJECTION_INVALID');
    }
    const ids = new Set();
    const targets = regionTargets.regions.map(region => {
      if (!Number.isInteger(region.regionId) || region.regionId < 0 || region.regionId >= ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT
        || ids.has(region.regionId) || ![region.x, region.y].every(Number.isFinite)) {
        throw new Error('BONSAI_FIRST_BLOOM_TARGET_REGION_INVALID');
      }
      ids.add(region.regionId);
      return {
        regionId: region.regionId,
        x: canvasRect.left - overlayRect.left + region.x * canvasRect.width / regionTargets.canvasCssWidth,
        y: canvasRect.top - overlayRect.top + region.y * canvasRect.height / regionTargets.canvasCssHeight,
      };
    });
    setProjection({ receipt: regionTargets, targets });
  }, [regionTargets, visible]);
  if (!visible || regionTargets === null) return null;
  return (
    <div ref={overlayRef} className="zen-bonsai-first-bloom-prompt" role="group"
      aria-label={t('target_protocol.bonsai_first_bloom_regions')} aria-busy={disabled}>
      {projection?.targets.map(region => {
        const selected = (activatedMask & (1 << region.regionId)) !== 0;
        return <button key={region.regionId} type="button" className="zen-bonsai-first-bloom-region"
          style={{ left: region.x, top: region.y, '--zen-bloom-cue-delay': `${region.regionId * 85}ms` }} data-selected={selected}
          aria-label={t(selected ? 'target_protocol.bonsai_first_bloom_region_opened'
            : 'target_protocol.bonsai_first_bloom_region_action', { region: region.regionId + 1 })}
          aria-disabled={disabled || selected} tabIndex={selected ? -1 : 0}
          onClick={() => { if (!disabled && !selected) void onActivate(region.regionId); }} />;
      })}
      {error !== null && <span className="sr-only" role="alert">
        {t('target_protocol.bonsai_first_bloom_error')}
      </span>}
    </div>
  );
}
