import React, { useEffect, useMemo, useState } from 'react';
import { runtimeGetURL } from '@/platform/chrome/ChromeService.js';
import { faviconQueryService } from '@/platform/storage/assets/FaviconQueryService.js';
import { isAllowedFaviconDataUrl } from '@/platform/storage/assets/faviconDataUrlPolicy.js';

const COLOR_PALETTE = ['#0f172a', '#111827', '#1f2937', '#312e81', '#7f1d1d', '#065f46'];
const EMPTY_SOURCE_CANDIDATES = Object.freeze([]);

function hashToIndex(value, modulo) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % modulo;
  }
  return hash;
}

function pickFallbackColor(seed) {
  const safe = String(seed || '').trim();
  if (!safe) return COLOR_PALETTE[0];
  return COLOR_PALETTE[hashToIndex(safe, COLOR_PALETTE.length)];
}

function buildExtensionFaviconUrls({ domain, pageUrl, size }) {
  if (!domain && !pageUrl) return [];
  const targets = [];
  const addTarget = (value) => {
    if (typeof value !== 'string') return;
    const normalized = value.trim();
    if (!normalized) return;
    if (!targets.includes(normalized)) targets.push(normalized);
  };

  if (/^https?:\/\//i.test(pageUrl)) {
    addTarget(pageUrl);
  }

  const base = domain
    ? (/^https?:\/\//i.test(domain) ? domain : `https://${domain}`)
    : '';
  addTarget(base);

  const host = String(domain || '').replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
  if (host && !host.startsWith('www.') && host.split('.').length === 2) {
    addTarget(`https://www.${host}`);
  }

  return targets
    .map((target) => runtimeGetURL(`_favicon/?pageUrl=${encodeURIComponent(target)}&size=${size}`))
    .filter((source) => /^(?:chrome|edge|moz|safari-web)-extension:\/\//i.test(source));
}

export default function Favicon({
  pageUrl = '',
  domain,
  size = 32,
  sourceSize = size,
  unframed = false,
  className,
  imgClassName,
  fallbackLabel,
  fallbackClassName,
  fallbackStyle,
  sourceCandidates = EMPTY_SOURCE_CANDIDATES,
  style = null,
}) {
  const [dataUrl, setDataUrl] = useState('');
  const [failedSources, setFailedSources] = useState([]);
  const [loadedSource, setLoadedSource] = useState('');

  const label = useMemo(() => String(fallbackLabel || domain || '').trim(), [fallbackLabel, domain]);
  const letter = label ? label[0].toUpperCase() : '?';
  const fallbackColor = useMemo(() => pickFallbackColor(label || domain), [label, domain]);
  const extensionSources = useMemo(
    () => buildExtensionFaviconUrls({ domain, pageUrl, size: sourceSize }),
    [domain, pageUrl, sourceSize]
  );
  const normalizedSourceCandidates = useMemo(
    () => [...new Set(
      (Array.isArray(sourceCandidates) ? sourceCandidates : [])
        .filter(isAllowedFaviconDataUrl)
        .map((source) => source.trim()),
    )],
    [sourceCandidates]
  );
  const candidateSources = useMemo(() => {
    // High-density consumers keep the requested browser raster when a smaller
    // stored icon arrives later. Existing consumers retain cached-first order.
    const primary = sourceSize > size ? [...extensionSources, dataUrl] : [dataUrl, ...extensionSources];
    const list = [...primary, ...normalizedSourceCandidates].filter(Boolean);
    return [...new Set(list)];
  }, [dataUrl, extensionSources, normalizedSourceCandidates, sourceSize, size]);
  const sourceIdentity = normalizedSourceCandidates.join('\n');
  const markFailedSource = (source) => {
    const normalized = typeof source === 'string' ? source.trim() : '';
    if (!normalized) return;
    setLoadedSource((previous) => previous === normalized ? '' : previous);
    setFailedSources((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
  };

  useEffect(() => {
    let isAlive = true;
    setDataUrl('');
    setFailedSources([]);
    if (!domain) return;

    const load = async () => {
      try {
        const nextDataUrl = await faviconQueryService.getDataUrl(domain);
        if (isAlive) setDataUrl(nextDataUrl);
      } catch (error) {
        if (isAlive) console.warn('[Favicon] Cache query failed:', error);
      }
    };

    const unsubscribe = faviconQueryService.subscribe(domain, () => {
      setDataUrl('');
      setFailedSources([]);
      load();
    });
    load();

    return () => {
      isAlive = false;
      unsubscribe();
    };
  }, [domain, faviconQueryService]);

  useEffect(() => {
    setFailedSources([]);
  }, [domain, pageUrl, sourceSize, sourceIdentity]);

  const activeSrc = useMemo(
    () => candidateSources.find((item) => !failedSources.includes(item)) || '',
    [candidateSources, failedSources]
  );
  const showImage = !!activeSrc && loadedSource === activeSrc;
  const wrapperClass = [
    'relative inline-flex items-center justify-center overflow-hidden',
    unframed ? 'rounded-[4px]' : 'rounded-lg border border-[var(--color-border)]',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const imageClass = ['h-full w-full object-contain', imgClassName].filter(Boolean).join(' ');
  const wrapperStyle = {
    width: size,
    height: size,
    backgroundColor: showImage ? (unframed ? 'transparent' : 'var(--color-background)') : fallbackColor,
    ...(style && typeof style === 'object' ? style : {}),
  };
  const letterStyle = {
    color: '#f8fafc',
    ...(fallbackStyle && typeof fallbackStyle === 'object' ? fallbackStyle : {}),
  };

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      {activeSrc && (
        <img
          key={activeSrc}
          src={activeSrc}
          alt=""
          className={`absolute inset-0 ${imageClass}`}
          style={{ opacity: showImage ? 1 : 0 }}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth <= 4 || image.naturalHeight <= 4) {
              markFailedSource(activeSrc);
            } else setLoadedSource(activeSrc);
          }}
          onError={() => {
            console.warn(`[Favicon] Load failed for ${domain}`, activeSrc.slice(0, 50) + '...');
            markFailedSource(activeSrc);
          }}
        />
      )}
      {!showImage && (
        <span className={['text-xs font-bold', fallbackClassName].filter(Boolean).join(' ')} style={letterStyle}>
          {letter}
        </span>
      )}
    </div>
  );
}
