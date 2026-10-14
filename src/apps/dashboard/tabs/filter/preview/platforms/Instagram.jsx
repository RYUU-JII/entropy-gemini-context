import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  getDashboardStateTransitionStyle,
  getInteractionMotionStyle,
} from '@/themes/core/motion/index.js';
import { resolveAssetUrl } from '../../../../../../domains/settings/config/settingsPreviewConfig.js';
import { MOCK_PLATFORM_DATA } from '../constants.js';
import { PreviewText, PreviewMediaImg, MockMetric, MockSurface, ICON_STYLE } from '@/themes/core/widgets/shared/preview/Common.jsx';
import threatsIcon from '../icons/threats_icon.png';

const IG_ICONS = {
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  explore: 'M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1 1.1-.49 1.1-1.1-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z',
  reels: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
  messenger: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
  heart: 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z',
  heartFilled: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  more: 'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  comment: 'M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',
  share: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
  bookmark: 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z',
  bookmarkFilled: 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z',
  chevronLeft: 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  chevronRight: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  emoji: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z',
  threads: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 13.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm-4.5-2c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  verified: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
};

const STORY_SWATCHES = ['bg-[#f97316]', 'bg-[#ec4899]', 'bg-[#8b5cf6]', 'bg-[#06b6d4]', 'bg-[#22c55e]', 'bg-[#f59e0b]', 'bg-[#ef4444]'];
const SUGGESTION_SWATCHES = ['bg-[#f97316]', 'bg-[#8b5cf6]', 'bg-[#0ea5e9]', 'bg-[#22c55e]', 'bg-[#ef4444]'];
const PREVIEW_PLATFORM_INTERACTION_STYLE = getInteractionMotionStyle('stable');
const PREVIEW_PLATFORM_ICON_BUTTON_STYLE = getDashboardStateTransitionStyle('dashboard.control.button');

function IgIcon({ path, className = 'h-6 w-6', style }) {
  const safePath = typeof path === 'string' ? path.trim() : '';
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} style={{ minWidth: '24px', ...ICON_STYLE, ...style }}>
      {safePath ? <path d={safePath} /> : null}
    </svg>
  );
}

function PlaceholderAvatar({ label, className, toneClass }) {
  return (
    <div className={`${className} ${toneClass} flex items-center justify-center rounded-full font-semibold text-white`}>
      {String(label || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function InstagramPost({ data, avatarUrl, captionText, hiddenMetrics, t, surfaceHidden = false }) {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const heartTimerRef = useRef(null);

  const handleDoubleClick = useCallback(() => {
    setIsLiked(true);
    setShowHeart(true);
    if (heartTimerRef.current) {
      clearTimeout(heartTimerRef.current);
    }
    heartTimerRef.current = setTimeout(() => {
      heartTimerRef.current = null;
      setShowHeart(false);
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (heartTimerRef.current) {
        clearTimeout(heartTimerRef.current);
        heartTimerRef.current = null;
      }
    };
  }, []);

  const toggleLike = useCallback(() => setIsLiked((prev) => !prev), []);
  const toggleSave = useCallback(() => setIsSaved((prev) => !prev), []);

  return (
    <div className="flex flex-col bg-white border-b border-gray-200 pb-5">
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3 cursor-pointer">
          <MockSurface hidden={surfaceHidden} className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 border border-gray-100">
            <PreviewMediaImg className="w-full h-full object-cover" src={avatarUrl} />
          </MockSurface>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm hover:opacity-50">{data.user}</span>
            <MockSurface as="span" hidden={surfaceHidden} className="inline-flex">
              <IgIcon path={IG_ICONS.verified} className="h-3 w-3 text-[#0095f6]" />
            </MockSurface>
            <span className="text-gray-500 text-sm">•</span>
            <span className="text-gray-500 text-sm hover:opacity-50 cursor-pointer tabular-nums">
              <MockMetric kind="exposure" hidden={hiddenMetrics.timeSignals}>{data.time}</MockMetric>
            </span>
          </div>
        </div>
        <IgIcon path={IG_ICONS.more} className="h-6 w-6 cursor-pointer hover:text-gray-500" />
      </div>

      <div className="aspect-square w-full bg-gray-100 overflow-hidden relative cursor-pointer rounded-[4px] border border-gray-100" onDoubleClick={handleDoubleClick}>
        <PreviewMediaImg className="h-full w-full object-cover object-center" alt="post" src={avatarUrl} />
        {showHeart && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><IgIcon path={IG_ICONS.heartFilled} className="w-28 h-28 text-white drop-shadow-2xl animate-heart-pop" /></div>}
      </div>

      <div className="flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <MockSurface hidden={surfaceHidden}>
              <button onClick={toggleLike} className="hover:opacity-50" style={PREVIEW_PLATFORM_ICON_BUTTON_STYLE}>
                <IgIcon path={isLiked ? IG_ICONS.heartFilled : IG_ICONS.heart} className={`h-6 w-6 ${isLiked ? 'text-[#ff3040]' : ''}`} />
              </button>
            </MockSurface>
            <span className="text-sm font-semibold tabular-nums"><MockMetric kind="engagement" hidden={hiddenMetrics.engagement}>5.5만</MockMetric></span>
          </div>
          <div className="flex items-center gap-1">
            <MockSurface hidden={surfaceHidden}>
              <button className="hover:opacity-50" style={PREVIEW_PLATFORM_ICON_BUTTON_STYLE}>
                <IgIcon path={IG_ICONS.comment} className="h-6 w-6" />
              </button>
            </MockSurface>
            <span className="text-sm font-semibold tabular-nums"><MockMetric kind="engagement" hidden={hiddenMetrics.engagement}>548</MockMetric></span>
          </div>
          <MockSurface hidden={surfaceHidden}>
            <button className="hover:opacity-50" style={PREVIEW_PLATFORM_ICON_BUTTON_STYLE}><IgIcon path={IG_ICONS.share} className="h-6 w-6" /></button>
          </MockSurface>
        </div>
        <MockSurface hidden={surfaceHidden}>
          <button onClick={toggleSave} className="hover:opacity-50" style={PREVIEW_PLATFORM_ICON_BUTTON_STYLE}><IgIcon path={isSaved ? IG_ICONS.bookmarkFilled : IG_ICONS.bookmark} className={`h-6 w-6 ${isSaved ? 'text-black' : ''}`} /></button>
        </MockSurface>
      </div>

      <div className="text-sm mb-1">
        <span className="font-semibold mr-1 cursor-pointer hover:opacity-50">{data.user}</span>
        <MockSurface as="span" hidden={surfaceHidden} className="inline-flex mr-2 align-middle">
          <IgIcon path={IG_ICONS.verified} className="h-3 w-3 text-[#0095f6]" />
        </MockSurface>
        <div className={!isExpanded ? 'line-clamp-3' : ''}>
          <PreviewText className="inline" isDynamic style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{captionText}</PreviewText>
        </div>
        {!isExpanded && (
          <button onClick={() => setIsExpanded(true)} className="text-gray-500 text-sm cursor-pointer hover:opacity-50 block mt-1">
            {t('preview.instagram.actions.view_more', { })}
          </button>
        )}
      </div>
    </div>
  );
}

export default function MockInstagram({ variant, baseText, hiddenMetrics, surfaceState }) {
  const { t } = useAppTranslation('settings');
  const pi = (key, options = {}) => t(`preview.instagram.${key}`, options);
  const data = MOCK_PLATFORM_DATA.instagram;
  const avatarUrl = variant?.url ? resolveAssetUrl(variant.url) : '';
  const captionText = baseText || MOCK_PLATFORM_DATA.defaults.captionFallback;
  const surfaceHidden = surfaceState?.socialSurface === true;
  const stories = [
    pi('story.your_story'),
    'grid.note',
    'frame.unit',
    'quiet.loop',
    'signal.lab',
  ];
  const suggestions = [
    { handle: 'momentum.user', subtitle: pi('suggestion.subtitle_recommended') },
    { handle: 'friend1.loop', subtitle: pi('suggestion.subtitle_followed_by_friend1') },
    { handle: 'tech.guru', subtitle: pi('suggestion.subtitle_followed_by_tech_guru') },
  ];

  return (
    <div
      className="flex h-full w-full overflow-y-auto bg-white text-[#111827]"
      style={{
        ...PREVIEW_PLATFORM_INTERACTION_STYLE,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      }}
    >
      <aside className="hidden xl:flex w-[220px] flex-col gap-3 border-r border-gray-100 px-4 py-5">
        {[
          { icon: IG_ICONS.home, label: pi('nav.home') },
          { icon: IG_ICONS.search, label: pi('nav.search') },
          { icon: IG_ICONS.explore, label: pi('nav.explore') },
          { icon: IG_ICONS.reels, label: pi('nav.reels') },
          { icon: IG_ICONS.messenger, label: pi('nav.messages') },
          { icon: IG_ICONS.heart, label: pi('nav.notifications') },
          { icon: IG_ICONS.add, label: pi('nav.create') },
          { icon: IG_ICONS.bookmark, label: pi('nav.profile') },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-gray-50">
            <IgIcon path={item.icon} className="h-6 w-6" />
            <span className="text-[15px] font-medium">{item.label}</span>
          </div>
        ))}
        <div className="mt-auto rounded-2xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={threatsIcon} alt="" className="h-7 w-7 rounded-lg object-cover" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-500">{pi('sidebar.threats')}</div>
              <div className="text-sm font-semibold text-gray-900">{pi('sidebar.more')}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="mx-auto flex w-full max-w-[980px] gap-8 px-4 py-6 lg:px-6">
        <section className="min-w-0 flex-1">
          <div className="mb-6 flex gap-4 overflow-x-auto border border-gray-100 bg-white px-4 py-4">
                {stories.map((story, index) => (
                  <div key={story} className="flex min-w-[68px] flex-col items-center gap-2">
                    <MockSurface hidden={surfaceHidden} className={`flex h-16 w-16 items-center justify-center rounded-full p-[2px] ${STORY_SWATCHES[index % STORY_SWATCHES.length]}`}>
                      <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[11px] font-bold text-white">
                        {avatarUrl ? (
                          <PreviewMediaImg className="h-full w-full rounded-full object-cover" src={avatarUrl} alt={story} />
                        ) : (
                          story.charAt(0).toUpperCase()
                        )}
                      </div>
                    </MockSurface>
                    <span className="max-w-[72px] truncate text-[11px] text-gray-700">{story}</span>
                  </div>
                ))}
          </div>

          <InstagramPost
            data={data}
            avatarUrl={avatarUrl}
            captionText={captionText}
            hiddenMetrics={hiddenMetrics}
            t={pi}
            surfaceHidden={surfaceHidden}
          />
        </section>

        <aside className="hidden w-[280px] shrink-0 lg:block">
          <div className="sticky top-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MockSurface hidden={surfaceHidden}>
                  <PlaceholderAvatar
                    label={data.user}
                    className="h-11 w-11"
                    toneClass="bg-linear-to-br/srgb from-[#f97316] via-[#ec4899] to-[#8b5cf6]"
                  />
                </MockSurface>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{data.user}</div>
                  <div className="text-xs text-gray-500">{pi('suggestion.momentum_user')}</div>
                </div>
              </div>
              <button type="button" className="text-xs font-semibold text-[#0095f6]">
                {pi('suggestion.switch')}
              </button>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-500">{pi('suggestion.for_you')}</div>
                <button type="button" className="text-xs font-semibold text-gray-900">
                  {pi('suggestion.see_all')}
                </button>
              </div>
              <div className="space-y-3">
                {suggestions.map((item, index) => (
                  <div key={item.handle} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <MockSurface hidden={surfaceHidden}>
                        <PlaceholderAvatar
                          label={item.handle}
                          className="h-10 w-10"
                          toneClass={SUGGESTION_SWATCHES[index % SUGGESTION_SWATCHES.length]}
                        />
                      </MockSurface>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900">{item.handle}</div>
                        <div className="truncate text-xs text-gray-500">{item.subtitle}</div>
                      </div>
                    </div>
                    <button type="button" className="text-xs font-semibold text-[#0095f6]">
                      {pi('suggestion.follow')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
