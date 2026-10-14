import React, { useId, useMemo, useState } from 'react';
import { useProtocolStore } from '../../../stores/useProtocolStore.js';
import { useRuntimeParkedStoreSlice } from '../../../hooks/useRuntimeParkedStoreSlice.js';
import { useAppTranslation } from '../../../../../ui-kit/hooks/useAppTranslation.js';
import { COOLING_CURVE_FAMILY_IDS, requireCoolingCurve } from '../../../../../domains/settings/config/coolingCurvePolicy.js';
import { useCoolingCurveSettingsActivity } from './CoolingCurveSettingsActivityContext.jsx';

export default function CoolingCurveFamilyControl({ familyId }) {
  if (!COOLING_CURVE_FAMILY_IDS.includes(familyId)) throw new Error('COOLING_CURVE_FAMILY_CONTROL_INVALID');
  const isActive = useCoolingCurveSettingsActivity();
  const selectMode = useMemo(() => state => ({
    mode: requireCoolingCurve(state.coolingCurve).families[familyId], setMode: state.setCoolingCurveFamilyMode,
  }), [familyId]);
  const { mode, setMode } = useRuntimeParkedStoreSlice(useProtocolStore, selectMode, isActive);
  const { t } = useAppTranslation('tools');
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const commit = async next => {
    setPending(true); setError(false);
    try {
      const result = await setMode(familyId, next);
      if (result?.error) throw result.error;
    } catch { setError(true); }
    finally { setPending(false); }
  };
  return <fieldset className="mb-4 border-b border-border/25 pb-4" disabled={pending || !isActive} aria-busy={pending} aria-describedby={`${id}-description`}>
    <legend className="mb-2 text-[11px] font-bold text-on-surface">{t('cooling_curve.strength')}</legend>
    <div className="flex gap-2">
      <button type="button" className="rounded-lg border border-border/40 px-3 py-2 text-[11px] aria-pressed:border-accent aria-pressed:text-accent" aria-pressed={mode === 'curve'} onClick={() => commit('curve')}>{t('cooling_curve.curve')}</button>
      <button type="button" className="rounded-lg border border-border/40 px-3 py-2 text-[11px] aria-pressed:border-accent aria-pressed:text-accent" aria-pressed={mode === 'fixed'} onClick={() => commit('fixed')}>{t('cooling_curve.fixed')}</button>
    </div>
    <p id={`${id}-description`} className="mt-2 text-[11px] leading-relaxed text-on-surface-muted">{t('cooling_curve.description')}</p>
    {error ? <p className="mt-2 text-[11px] text-danger" role="alert">{t('cooling_curve.save_error')}</p> : null}
  </fieldset>;
}
