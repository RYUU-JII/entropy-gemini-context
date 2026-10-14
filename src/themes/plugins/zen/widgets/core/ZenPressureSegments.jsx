import React, { useCallback, useEffect, useRef, useState } from 'react';

import Favicon from '@/ui-kit/Favicon.jsx';
import {
  formatZenPressureDuration,
  formatZenPressurePercent,
  resolveZenPressureText,
} from './zenPressureRailFormatters.js';
import {
  normalizeZenPressureDomain,
  ZEN_PRESSURE_FAVICON_SIZE_PX,
  ZEN_PRESSURE_FAVICON_SOURCE_SIZE_PX,
} from './zenPressureRailPresentationModel.js';
import {
  ZEN_PRESSURE_COLORS,
  resolveZenPressureInteractionFill,
  resolveZenPressureRestFill,
  resolveZenPressureTone,
} from './zenPressureRailTonePolicy.js';

const OTHER_HOVER_ID = '__other__';

function resolvePointerTarget(event) {
  // Native hit testing follows the painted allocation, including width changes.
  const target = event.target.closest?.('[data-pressure-target]');
  if (!target || !event.currentTarget.contains(target)) return null;
  return target.dataset.pressureTarget === 'site' ? target.dataset.domain : OTHER_HOVER_ID;
}

export function ZenPressureSegments({ model, frameVariant, hoveredDomain, onSelectDomain, onHoverDomain, t }) {
  const rootRef = useRef(null);
  const pointerFocusRef = useRef(false);
  const touchGestureRef = useRef(null);
  const publishedDomainRef = useRef(null);
  const hoverCallbackRef = useRef(onHoverDomain);
  hoverCallbackRef.current = onHoverDomain;
  const [pointerHoverId, setPointerHoverId] = useState(null);
  const [focusedDomain, setFocusedDomain] = useState(null);
  const [touchDomain, setTouchDomain] = useState(null);
  const usesSlabCut = frameVariant === 'slab-cut';
  const canOpen = typeof onSelectDomain === 'function';
  const externalHoverDomain = normalizeZenPressureDomain(hoveredDomain);
  const localHoverId = focusedDomain || touchDomain || pointerHoverId;
  const requestedHoverId = localHoverId || externalHoverDomain;
  const activeHoverId = requestedHoverId === OTHER_HOVER_ID && model.otherSegment
    ? OTHER_HOVER_ID
    : model.segments.some(site => site.domain === requestedHoverId) ? requestedHoverId : null;

  const publishHover = useCallback((domain) => {
    if (publishedDomainRef.current === domain) return;
    publishedDomainRef.current = domain;
    hoverCallbackRef.current?.(domain);
  }, []);
  useEffect(() => {
    const domain = localHoverId !== OTHER_HOVER_ID && model.segments.some(site => site.domain === localHoverId)
      ? localHoverId : null;
    publishHover(domain);
  }, [localHoverId, model.segments, publishHover]);
  useEffect(() => () => publishHover(null), [publishHover]);

  useEffect(() => {
    const contains = domain => model.segments.some(site => site.domain === domain);
    if (focusedDomain && !contains(focusedDomain)) setFocusedDomain(null);
    if (touchDomain && !contains(touchDomain)) setTouchDomain(null);
    if (pointerHoverId && (pointerHoverId === OTHER_HOVER_ID ? !model.otherSegment : !contains(pointerHoverId))) {
      setPointerHoverId(null);
    }
  }, [focusedDomain, model.otherSegment, model.segments, pointerHoverId, touchDomain]);

  useEffect(() => {
    if (!touchDomain) return undefined;
    const dismissOutsideTouch = event => {
      if (rootRef.current?.contains(event.target)) return;
      touchGestureRef.current = null;
      pointerFocusRef.current = false;
      setTouchDomain(null);
    };
    document.addEventListener('pointerdown', dismissOutsideTouch, true);
    return () => document.removeEventListener('pointerdown', dismissOutsideTouch, true);
  }, [touchDomain]);

  if (model.segments.length === 0 && !model.otherSegment) return null;

  const otherLabel = resolveZenPressureText(t, 'target_protocol.legend_other_sites', {}, 'Other');
  const protectedLabel = resolveZenPressureText(t, 'target_protocol.legend_protected_short', {}, 'Protected');
  const openLabel = resolveZenPressureText(t, 'main.brief_action_review_site', {}, 'Open in Sites');

  return (
    <div
      ref={rootRef}
      data-testid="pressure-segments"
      className={`zen-pressure-segments flex h-full overflow-hidden ${usesSlabCut ? 'rounded-none border-0' : 'rounded-[15px]'}`}
      style={{ width: model.width, ...(usesSlabCut ? {} : { borderColor: 'var(--color-border-muted)' }) }}
      onPointerMove={event => {
        if (event.pointerType === 'touch') return;
        setFocusedDomain(null);
        setTouchDomain(null);
        setPointerHoverId(resolvePointerTarget(event));
      }}
      onPointerLeave={() => { pointerFocusRef.current = false; setPointerHoverId(null); }}
      onPointerDownCapture={event => {
        pointerFocusRef.current = true;
        setFocusedDomain(null);
        const target = resolvePointerTarget(event);
        if (event.pointerType === 'touch') {
          const domain = target === OTHER_HOVER_ID ? null : target;
          touchGestureRef.current = { revealOnly: Boolean(domain) && touchDomain !== domain };
          setPointerHoverId(null);
          setTouchDomain(domain);
        } else {
          touchGestureRef.current = null;
          setTouchDomain(null);
          setPointerHoverId(target);
        }
      }}
      onPointerUp={() => { pointerFocusRef.current = false; }}
      onPointerCancel={() => {
        pointerFocusRef.current = false;
        touchGestureRef.current = null;
        setTouchDomain(null);
        setPointerHoverId(null);
      }}
      onClickCapture={event => {
        const gesture = touchGestureRef.current;
        touchGestureRef.current = null;
        if (!gesture?.revealOnly) return;
        // A first touch only reveals, including a synthetic click landing on the
        // favicon that became visible during this same gesture.
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDownCapture={event => {
        if (event.key === 'Escape') return;
        pointerFocusRef.current = false;
        touchGestureRef.current = null;
        setPointerHoverId(null);
        setTouchDomain(null);
        const action = event.target.closest?.('[data-testid="pressure-domain-action"]');
        if (action && event.currentTarget.contains(action)) setFocusedDomain(action.dataset.domain);
      }}
    >
      {model.segments.map(site => {
        const tone = resolveZenPressureTone(site.policyDisposition);
        const hovered = activeHoverId === site.domain;
        const policyLabel = resolveZenPressureText(t, tone.labelKey, {}, tone.fallbackLabel);
        const rankLabel = site.pressureRank > 0
          ? resolveZenPressureText(t, 'target_protocol.share_pressure_rank', { rank: site.pressureRank }, `Pressure #${site.pressureRank}`)
          : formatZenPressureDuration(site.activeMs, t);
        const label = [site.domain, policyLabel, rankLabel, formatZenPressurePercent(site.pressureShare), canOpen ? openLabel : null].filter(Boolean).join(' · ');
        return (
          <div
            key={site.domain}
            data-testid="pressure-segment"
            data-pressure-target="site"
            data-domain={site.domain}
            data-policy={tone.id}
            data-hovered={hovered ? 'true' : 'false'}
            data-pressure-share={String(site.pressureShare)}
            className="zen-pressure-segment-cell zen-pressure-segment-face relative h-full min-w-0"
            style={{
              flex: `0 0 ${site.visualWidth}px`,
              '--zen-pressure-pigment': hovered ? resolveZenPressureInteractionFill(tone.base) : resolveZenPressureRestFill(tone.base, site.pressureShare),
            }}
          >
            <button
              type="button"
              data-testid="pressure-domain-action"
              data-domain={site.domain}
              data-revealed={hovered ? 'true' : 'false'}
              aria-label={label}
              disabled={!canOpen}
              onFocus={() => {
                if (pointerFocusRef.current) return;
                setFocusedDomain(site.domain);
                setTouchDomain(null);
              }}
              onBlur={() => setFocusedDomain(current => current === site.domain ? null : current)}
              onClick={() => onSelectDomain?.(site.domain)}
              className="zen-pressure-domain-action"
              style={{ opacity: hovered ? 1 : 0, pointerEvents: hovered ? 'auto' : 'none' }}
            >
              <span className="zen-pressure-segment-favicon" aria-hidden="true">
                <Favicon domain={site.domain} size={ZEN_PRESSURE_FAVICON_SIZE_PX} sourceSize={ZEN_PRESSURE_FAVICON_SOURCE_SIZE_PX} unframed />
              </span>
            </button>
          </div>
        );
      })}
      {model.otherSegment ? (
        <div
          role="img"
          data-testid="pressure-other-segment"
          data-pressure-target="other"
          data-policy="other"
          data-hovered={activeHoverId === OTHER_HOVER_ID ? 'true' : 'false'}
          data-protected-ratio={String(Math.round(model.otherSegment.aggregate.protectedRatio * 100) / 100)}
          aria-label={[
            `${otherLabel} · ${formatZenPressurePercent(model.otherShare)}`,
            model.otherSegment.aggregate.activeMs > 0 ? formatZenPressureDuration(model.otherSegment.aggregate.activeMs, t) : '',
            model.otherSegment.aggregate.protectedMs > 0 ? `${protectedLabel} ${formatZenPressureDuration(model.otherSegment.aggregate.protectedMs, t)}` : '',
          ].filter(Boolean).join(' · ')}
          className="zen-pressure-segment-face zen-pressure-segment-face--other relative h-full min-w-0"
          style={{
            flex: `0 0 ${model.otherSegment.visualWidth}px`,
            '--zen-pressure-pigment': activeHoverId === OTHER_HOVER_ID ? resolveZenPressureInteractionFill(ZEN_PRESSURE_COLORS.other) : resolveZenPressureRestFill(ZEN_PRESSURE_COLORS.other, model.otherShare),
          }}
        />
      ) : null}
    </div>
  );
}

export default ZenPressureSegments;
