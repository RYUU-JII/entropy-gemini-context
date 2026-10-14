import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Square } from 'lucide-react';
import { normalizeDomain } from '../../../../../lib/domain.js';
import {
  SPECIAL_SESSION_DEFAULT_DURATION_MINUTES,
  SPECIAL_SESSION_DURATION_OPTIONS_MINUTES,
} from '../../../../../domains/settings/config/specialSession.js';
import { SCHEDULE_SPECIAL_SESSION_PANEL_ID } from './scheduleSpecialSessionContract.js';

function formatSessionEndTime(endsAt) {
  const numeric = Number(endsAt);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return new Date(numeric).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string') return error.message;
  if (typeof error?.error === 'string') return error.error;
  return '';
}

function AllowedHosts({ hosts, emptyLabel }) {
  return hosts.length ? <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
    {hosts.map((host) => <li key={host} className="min-w-0 break-all">{host}</li>)}
  </ul> : <p className="text-sm opacity-70">{emptyLabel}</p>;
}

export default function ScheduleSpecialSessionPanel({
  allowedUrls = [], busy = false, error = null, onAddTemporaryAllowedSite,
  onEnd, onStart, onRetry, visualTokens, typography,
  panelId = SCHEDULE_SPECIAL_SESSION_PANEL_ID, session, t,
}) {
  const titleRef = useRef(null);
  const [durationMinutes, setDurationMinutes] = useState(SPECIAL_SESSION_DEFAULT_DURATION_MINUTES);
  const [hostInput, setHostInput] = useState('');
  const [draftTemporaryHosts, setDraftTemporaryHosts] = useState([]);
  const active = session?.active === true;
  const accent = visualTokens.isolationInk;
  const savedAllowlist = useMemo(() => Array.isArray(allowedUrls) ? allowedUrls : [], [allowedUrls]);
  const temporaryHosts = active ? session.temporaryAllowedHosts : draftTemporaryHosts;
  const normalizedInput = normalizeDomain(hostInput);
  const errorDetail = getErrorMessage(error);
  const controlStyle = { borderColor: visualTokens.stageEdge, outlineColor: visualTokens.focusMarker };

  useEffect(() => { titleRef.current?.focus(); }, []);

  const addTemporaryHost = async () => {
    if (!normalizedInput || busy) return;
    if (active) {
      const result = await onAddTemporaryAllowedSite(normalizedInput);
      if (!result) return;
    } else {
      setDraftTemporaryHosts((current) => current.includes(normalizedInput) ? current
        : [...current, normalizedInput].sort((left, right) => left.localeCompare(right)));
    }
    setHostInput('');
  };

  return <section id={panelId} data-special-session-panel aria-busy={busy}
    aria-labelledby={`${panelId}-title`} className="schedule-session-workbench min-w-0 py-5"
    style={{ color: visualTokens.inkPrimary, fontFamily: typography.body }}>
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 ref={titleRef} tabIndex={-1} id={`${panelId}-title`} className="text-lg font-semibold outline-hidden">
        {active ? t(`special_session.active_${session.mode}`) : t('special_session.title')}
      </h2>
      {active ? <p role="status" className="text-sm tabular-nums" style={{ color: visualTokens.inkMuted }}>
        {t('special_session.ends_at', { time: formatSessionEndTime(session.endsAt) })}
      </p> : null}
    </div>
    {!active ? <>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: visualTokens.inkMuted }}>
        {t('special_session.description')}
      </p>
      <div className="mt-4 flex flex-wrap gap-2" aria-label={t('special_session.title')}>
        {SPECIAL_SESSION_DURATION_OPTIONS_MINUTES.map((minutes) => <button key={minutes} type="button"
          disabled={busy} aria-pressed={durationMinutes === minutes} onClick={() => setDurationMinutes(minutes)}
          className="min-h-11 border px-5 text-sm font-semibold tabular-nums disabled:opacity-50"
          style={{ ...controlStyle, color: durationMinutes === minutes ? accent : visualTokens.inkMuted,
            background: durationMinutes === minutes ? visualTokens.stageHighlight : 'transparent' }}>
          {t('special_session.duration_minutes', { minutes })}
        </button>)}
      </div>
    </> : null}
    <div className="mt-5 grid min-w-0 gap-5 md:grid-cols-2">
      <div className="min-w-0">
        <h3 className="mb-2 text-sm font-semibold" style={{ color: visualTokens.inkMuted }}>{t('special_session.allowed_sites')}</h3>
        <AllowedHosts hosts={savedAllowlist} emptyLabel={t('special_session.allowlist_empty')} />
      </div>
      <div className="min-w-0">
        <h3 className="mb-2 text-sm font-semibold" style={{ color: visualTokens.inkMuted }}>{t('special_session.temporary_sites')}</h3>
        <AllowedHosts hosts={Array.isArray(temporaryHosts) ? temporaryHosts : []} emptyLabel={t('special_session.allowlist_empty')} />
        {(!active || session.source === 'manual') ? <form className="mt-3 flex gap-2" onSubmit={(event) => {
          event.preventDefault(); void addTemporaryHost();
        }}>
          <input type="text" disabled={busy} aria-label={t('special_session.temp_host_placeholder')}
            value={hostInput} onChange={(event) => setHostInput(event.target.value)}
            placeholder={t('special_session.temp_host_placeholder')}
            className="min-h-11 min-w-0 flex-1 border bg-transparent px-3 text-sm" style={controlStyle} />
          <button type="submit" aria-label={t('special_session.add_temp_host')} disabled={!normalizedInput || busy}
            className="flex min-h-11 min-w-11 items-center justify-center border disabled:opacity-40" style={controlStyle}>
            <Plus aria-hidden="true" className="h-4 w-4" />
          </button>
        </form> : null}
      </div>
    </div>
    {error ? <div role="alert" className="mt-4 text-sm" style={{ color: visualTokens.danger }}>
      <p>{t('special_session.error')}</p>
      {errorDetail ? <p className="mt-1 break-words font-mono text-xs">{errorDetail}</p> : null}
      {onRetry ? <button type="button" className="min-h-11 underline underline-offset-4" onClick={onRetry}>
        {t('special_session.retry')}
      </button> : null}
    </div> : null}
    <div className="mt-5 flex justify-end">
      <button type="button" disabled={busy} onClick={() => {
        if (busy) return;
        if (active) void onEnd();
        else void onStart({ durationMinutes, temporaryAllowedHosts: draftTemporaryHosts });
      }} className="inline-flex min-h-11 items-center gap-2 border px-5 text-sm font-semibold disabled:opacity-50"
        style={{ ...controlStyle, background: active ? 'transparent' : accent,
          color: active ? accent : visualTokens.onDarkInk }}>
        {active ? <Square aria-hidden="true" className="h-3.5 w-3.5" /> : null}
        {active ? t(session.source === 'schedule' ? 'modes.end_occurrence' : 'special_session.end')
          : t(busy ? 'special_session.starting' : 'special_session.start')}
      </button>
    </div>
  </section>;
}
