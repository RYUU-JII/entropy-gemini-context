import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  requireTextRhythmRuntimeProfile,
  resolveSocialMetricVisibilityState,
} from '@/domains/settings/config/index.js';

const ZONE_PULSE_MS = 1200;
const TRACE_LIMIT = 10;

function normalizeDelay(entry) {
  if (!entry?.isActive) return 0;
  const numeric = Number(entry.value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function normalizeNumber(entry) {
  if (!entry?.isActive) return 0;
  const numeric = typeof entry.value === 'number'
    ? entry.value
    : parseFloat(String(entry.value ?? ''));
  if (!Number.isFinite(numeric)) return 0;
  return numeric;
}

function parseLines(raw, fallback) {
  const source = String(raw || fallback || '');
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines.slice(0, 6) : [String(fallback || '')];
}

function buildActiveEffects(settings) {
  const effects = [];
  const socialMetricVisibility = resolveSocialMetricVisibilityState(settings);

  const inputDelayMs = normalizeDelay(settings?.inputDelay);
  if (inputDelayMs > 0) {
    effects.push({
      id: 'input_delay',
      label: 'Input delay',
      value: `${inputDelayMs}ms`,
      zones: ['interaction'],
    });
  }

  const clickDelayMs = normalizeDelay(settings?.clickDelay);
  if (clickDelayMs > 0) {
    effects.push({
      id: 'click_delay',
      label: 'Click intent gate',
      value: `${clickDelayMs}ms`,
      zones: ['interaction'],
    });
  }

  const scrollDelayMs = normalizeDelay(settings?.scrollFriction);
  if (scrollDelayMs > 0) {
    effects.push({
      id: 'scroll_friction',
      label: 'Scroll inertia',
      value: `${scrollDelayMs}ms`,
      zones: ['interaction'],
    });
  }

  if (settings?.textRhythm?.isActive) {
    const profile = requireTextRhythmRuntimeProfile(settings.textRhythm.value);
    effects.push({
      id: 'text_rhythm',
      label: 'Text rhythm',
      value: profile.band,
      zones: ['text'],
    });
  }

  const blur = normalizeNumber(settings?.blur);
  if (settings?.blur?.isActive && Math.abs(blur) > 0) {
    effects.push({
      id: 'visual_blur',
      label: 'Visual blur',
      value: `${blur}px`,
      zones: ['media'],
    });
  }

  const saturationEntry = settings?.saturation;
  const saturation = normalizeNumber(saturationEntry);
  if (saturationEntry?.isActive) {
    effects.push({
      id: 'visual_saturation',
      label: 'Saturation',
      value: `${Math.max(0, Math.round(saturation * 100))}%`,
      zones: ['media'],
    });
  }

  if (socialMetricVisibility.engagement) {
    effects.push({
      id: 'social_engagement',
      label: 'Engagement fade',
      value: 'active',
      zones: ['metrics'],
    });
  }

  if (socialMetricVisibility.exposure) {
    effects.push({
      id: 'social_exposure',
      label: 'Exposure fade',
      value: 'active',
      zones: ['metrics'],
    });
  }

  return effects;
}

function toEffectSignature(effects) {
  return effects
    .map((effect) => `${effect.id}:${effect.value}`)
    .sort()
    .join('|');
}

function formatTraceMessage(effect) {
  const zoneLabel = effect.zones.join(' + ');
  if (effect.value) {
    return `${effect.label} -> ${zoneLabel} (${effect.value})`;
  }
  return `${effect.label} -> ${zoneLabel}`;
}

export default function useLabSimulationState({
  settings,
  baseText,
  sourceText,
  hiddenMetrics,
  bodyFallback,
}) {
  const [compareMode, setCompareMode] = useState('after');
  const [liveInput, setLiveInput] = useState('');
  const [delayedInput, setDelayedInput] = useState('');
  const [pendingActions, setPendingActions] = useState([]);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [tickerTs, setTickerTs] = useState(Date.now());
  const [traceEntries, setTraceEntries] = useState(() => [
    {
      id: 'boot',
      message: 'Session ready. Adjust controls to see zone reactions.',
      ts: Date.now(),
    },
  ]);
  const [highlightedZones, setHighlightedZones] = useState(() => new Set());

  const inputTimerRef = useRef(null);
  const actionTimersRef = useRef(new Set());
  const actionSeqRef = useRef(0);
  const zoneTimersRef = useRef(new Map());
  const prevEffectSignatureRef = useRef('');
  const prevEffectsRef = useRef([]);

  const inputDelayMs = normalizeDelay(settings?.inputDelay);
  const clickDelayMs = normalizeDelay(settings?.clickDelay);
  const scrollDelayMs = normalizeDelay(settings?.scrollFriction);

  const fallbackHiddenMetrics = useMemo(
    () => {
      const visibility = resolveSocialMetricVisibilityState(settings);
      return {
        engagement: visibility.engagement,
        exposure: visibility.exposure,
      };
    },
    [settings]
  );

  const resolvedHiddenMetrics = hiddenMetrics || fallbackHiddenMetrics;

  const rawEffects = useMemo(() => buildActiveEffects(settings), [settings]);
  const activeEffects = compareMode === 'after' ? rawEffects : [];

  const bodyLinesBefore = useMemo(
    () => parseLines(sourceText || baseText, bodyFallback),
    [sourceText, baseText, bodyFallback]
  );

  const bodyLinesAfter = useMemo(
    () => parseLines(baseText, bodyFallback),
    [baseText, bodyFallback]
  );

  const bodyLines = compareMode === 'after' ? bodyLinesAfter : bodyLinesBefore;

  const hideEngagement = compareMode === 'after' ? !!resolvedHiddenMetrics.engagement : false;
  const hideExposure = compareMode === 'after' ? !!resolvedHiddenMetrics.exposure : false;

  const effectiveInputDelayMs = compareMode === 'after' ? inputDelayMs : 0;
  const effectiveClickDelayMs = compareMode === 'after' ? clickDelayMs : 0;

  const appendTrace = useCallback((message) => {
    const nextEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message,
      ts: Date.now(),
    };
    setTraceEntries((prev) => [nextEntry, ...prev].slice(0, TRACE_LIMIT));
  }, []);

  const pulseZone = useCallback((zoneId) => {
    setHighlightedZones((prev) => {
      const next = new Set(prev);
      next.add(zoneId);
      return next;
    });

    const prevTimer = zoneTimersRef.current.get(zoneId);
    if (prevTimer) clearTimeout(prevTimer);

    const timerId = setTimeout(() => {
      setHighlightedZones((prev) => {
        const next = new Set(prev);
        next.delete(zoneId);
        return next;
      });
      zoneTimersRef.current.delete(zoneId);
    }, ZONE_PULSE_MS);

    zoneTimersRef.current.set(zoneId, timerId);
  }, []);

  useEffect(() => {
    const signature = toEffectSignature(activeEffects);
    if (signature === prevEffectSignatureRef.current) return;

    const prevEffects = prevEffectsRef.current;
    prevEffectSignatureRef.current = signature;
    prevEffectsRef.current = activeEffects;

    if (compareMode !== 'after') {
      appendTrace('Preview mode switched to baseline. Active distortions hidden.');
      return;
    }

    if (activeEffects.length === 0) {
      if (prevEffects.length > 0) {
        const removedZones = new Set();
        prevEffects.forEach((effect) => {
          effect.zones.forEach((zoneId) => removedZones.add(zoneId));
        });
        removedZones.forEach((zoneId) => pulseZone(zoneId));
        appendTrace('All active filter effects cleared.');
      } else {
        appendTrace('No active filter effects.');
      }
      return;
    }

    const prevById = new Map(prevEffects.map((effect) => [effect.id, effect]));
    const nextById = new Map(activeEffects.map((effect) => [effect.id, effect]));

    const changedEffects = activeEffects.filter((effect) => {
      const prev = prevById.get(effect.id);
      if (!prev) return true;
      return String(prev.value) !== String(effect.value);
    });

    const removedEffects = prevEffects.filter((effect) => !nextById.has(effect.id));

    const touchedZones = new Set();
    changedEffects.forEach((effect) => {
      effect.zones.forEach((zoneId) => touchedZones.add(zoneId));
    });
    removedEffects.forEach((effect) => {
      effect.zones.forEach((zoneId) => touchedZones.add(zoneId));
    });

    if (touchedZones.size === 0) {
      appendTrace('Filter state changed.');
      return;
    }

    touchedZones.forEach((zoneId) => pulseZone(zoneId));

    changedEffects.slice(0, 3).forEach((effect) => {
      appendTrace(formatTraceMessage(effect));
    });
    removedEffects.slice(0, 2).forEach((effect) => {
      appendTrace(`${effect.label} removed from ${effect.zones.join(' + ')}`);
    });
  }, [activeEffects, compareMode, appendTrace, pulseZone]);

  useEffect(() => {
    if (pendingActions.length === 0) return undefined;
    const intervalId = setInterval(() => setTickerTs(Date.now()), 120);
    return () => clearInterval(intervalId);
  }, [pendingActions.length]);

  const pendingSnaps = useMemo(() => {
    const baseDelay = Math.max(1, effectiveClickDelayMs);
    return pendingActions.map((entry) => {
      const remain = Math.max(0, entry.releaseAt - tickerTs);
      return {
        id: entry.id,
        remain,
        progress: Math.min(1, Math.max(0, 1 - remain / baseDelay)),
      };
    });
  }, [pendingActions, effectiveClickDelayMs, tickerTs]);

  const handleInput = useCallback((event) => {
    const nextValue = event.target.value;
    setLiveInput(nextValue);

    if (inputTimerRef.current) clearTimeout(inputTimerRef.current);

    if (effectiveInputDelayMs <= 0) {
      setDelayedInput(nextValue);
      return;
    }

    inputTimerRef.current = setTimeout(() => {
      setDelayedInput(nextValue);
    }, effectiveInputDelayMs);
  }, [effectiveInputDelayMs]);

  const handleClick = useCallback(() => {
    if (effectiveClickDelayMs <= 0) {
      setResolvedCount((prev) => prev + 1);
      appendTrace('Action dispatched instantly (baseline mode).');
      return;
    }

    const seq = actionSeqRef.current + 1;
    actionSeqRef.current = seq;
    const releaseAt = Date.now() + effectiveClickDelayMs;

    setPendingActions((prev) => [...prev, { id: seq, releaseAt }].slice(-8));

    const timerId = setTimeout(() => {
      setPendingActions((prev) => prev.filter((action) => action.id !== seq));
      setResolvedCount((prev) => prev + 1);
      actionTimersRef.current.delete(timerId);
    }, effectiveClickDelayMs);

    actionTimersRef.current.add(timerId);
  }, [appendTrace, effectiveClickDelayMs]);

  useEffect(
    () => () => {
      if (inputTimerRef.current) clearTimeout(inputTimerRef.current);
      actionTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      actionTimersRef.current.clear();
      zoneTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      zoneTimersRef.current.clear();
    },
    []
  );

  return {
    compareMode,
    setCompareMode,
    activeEffects,
    highlightedZones,
    traceEntries,
    bodyLines,
    bodyLinesBefore,
    bodyLinesAfter,
    hideEngagement,
    hideExposure,
    liveInput,
    delayedInput,
    handleInput,
    handleClick,
    pendingSnaps,
    queueDepth: pendingActions.length,
    resolvedCount,
    inputDelayMs,
    clickDelayMs,
    scrollDelayMs,
  };
}
