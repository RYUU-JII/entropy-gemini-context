import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  getDashboardStateTransitionStyle,
  getInteractionMotionStyle,
} from '@/themes/core/motion/index.js';
import { resolveAssetUrl } from '../../../../../../domains/settings/config/settingsPreviewConfig.js';
import { MOCK_PLATFORM_DATA } from '../constants.js';
import { PreviewText, PreviewMediaImg, MockMetric, MockSurface, MEDIA_STYLE, ICON_STYLE } from '@/themes/core/widgets/shared/preview/Common.jsx';

const TT_ICONS = {
  logo: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.08 6.33 6.33 0 0 0-5.39 10.69 6.33 6.33 0 0 0 10.86-4.42V8.69a8.18 8.18 0 0 0 4.77 1.53v-3.44a4.85 4.85 0 0 1-1-.1z',
  home: 'M11.0001 18V11H14.0001V18H19.0001V10H22.0001L12.5001 1.5L3.00006 10H6.00006V18H11.0001Z',
  friends: 'M14 11.5C14 13.433 12.433 15 10.5 15C8.567 15 7 13.433 7 11.5C7 9.567 8.567 8 10.5 8C12.433 8 14 9.567 14 11.5ZM19.5 15C21.433 15 23 13.433 23 11.5C23 9.567 21.433 8 19.5 8C17.567 8 16 9.567 16 11.5C16 13.433 17.567 15 19.5 15ZM4.5 15C6.433 15 8 13.433 8 11.5C8 9.567 6.433 8 4.5 8C2.567 8 1 9.567 1 11.5C1 13.433 2.567 15 4.5 15Z',
  add: 'M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z',
  inbox: 'M19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5ZM5 7H19V9.82843L12 16.8284L5 9.82843V7ZM19 17H5V12.6569L12 19.6569L19 12.6569V17Z',
  heart: 'M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z',
  heartFilled: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  comment: 'M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z',
  bookmark: 'M17 3H7C5.9 3 5 3.9 5 5V21L12 18L19 21V5C19 3.9 18.1 3 17 3Z',
  share: 'M14 9V5L21 12L14 19V14.9C9 14.9 5.5 16.5 3 20C4 15 7 10 14 9Z',
  music: 'M12 3V13.55C11.41 13.21 10.73 13 10 13C7.79 13 6 14.79 6 17C6 19.21 7.79 21 10 21C12.21 21 14 19.21 14 17V7H18V3H12Z',
  search: 'M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 13.09 3 9.5 3C5.91 3 3 5.91 3 9.5C3 13.09 5.91 16 9.5 16C11.11 16 12.59 15.41 13.73 14.43L14.01 14.71V15.5L19 20.49L20.49 19L15.5 14ZM9.5 14C7.01 14 5 11.99 5 9.5C5 7.01 7.01 5 9.5 5C11.99 5 14 7.01 14 9.5C14 11.99 11.99 14 9.5 14Z',
  live: 'M17 6H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H7V8h10v8zm-3-5l-4 2V9l4 2z',
  more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  arrowUp: 'M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z',
  arrowDown: 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z',
};

const POSTS = [0, 1, 2];
const SUGGESTED_USERS = [
  { handle: 'studiogrid', name: 'Studio Grid' },
  { handle: 'quietsignal', name: 'Quiet Signal' },
  { handle: 'framehabit', name: 'Frame Habit' },
];
const wrapIndex = (value, size) => ((value % size) + size) % size;
const PREVIEW_PLATFORM_INTERACTION_STYLE = getInteractionMotionStyle('stable');
const PREVIEW_PLATFORM_BUTTON_STYLE = getDashboardStateTransitionStyle('dashboard.control.button');
const PREVIEW_PLATFORM_PROGRESS_STYLE = getDashboardStateTransitionStyle('dashboard.control.progress');

function TtIcon({ path, className = 'h-6 w-6', style }) {
  const safePath = typeof path === 'string' ? path.trim() : '';
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} style={{ minWidth: '24px', ...ICON_STYLE, ...style }}>
      {safePath ? <path d={safePath} /> : null}
    </svg>
  );
}

export default function MockTikTok({ variant, baseText, hiddenMetrics, surfaceState }) {
  const { t } = useAppTranslation('settings');
  const tt = (key) => t(`preview.tiktok.${key}`);
  const data = MOCK_PLATFORM_DATA.tiktok;
  const captionText = baseText || MOCK_PLATFORM_DATA.defaults.captionFallback;
  const avatarUrl = variant?.url ? resolveAssetUrl(variant.url) : '';
  const surfaceHidden = surfaceState?.socialSurface === true;

  const LOOP_SIZE = 5;
  const LOOP_CENTER = 2;
  const TRANSITION_MS = 420;
  const [loopIndex, setLoopIndex] = useState(LOOP_CENTER);
  const [currentPost, setCurrentPost] = useState(0);
  const trackRef = useRef(null);
  const animRef = useRef(null);
  const prevIndexRef = useRef(LOOP_CENTER);
  const skipAnimRef = useRef(false);
  const pendingDeltaRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [actionIcon, setActionIcon] = useState(null);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const wheelLockRef = useRef(false);
  const actionIconTimerRef = useRef(null);
  const wheelLockTimerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const queueMove = useCallback((delta) => {
    setLoopIndex((prev) => {
      if (prev !== LOOP_CENTER) return prev;
      pendingDeltaRef.current = delta;
      return prev + delta;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        queueMove(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        queueMove(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (actionIconTimerRef.current) clearTimeout(actionIconTimerRef.current);
      if (wheelLockTimerRef.current) clearTimeout(wheelLockTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setIsPlaying(true);
    setActionIcon(null);

    if (loopIndex === LOOP_CENTER) {
      pendingDeltaRef.current = null;
    }
    return undefined;
  }, [loopIndex]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const startIndex = prevIndexRef.current;
    const endIndex = loopIndex;
    prevIndexRef.current = loopIndex;

    const step = 100 / LOOP_SIZE;
    const startY = -startIndex * step;
    const endY = -endIndex * step;

    if (startIndex === endIndex) {
      track.style.transform = `translateY(${endY}%)`;
      return;
    }

    if (skipAnimRef.current) {
      skipAnimRef.current = false;
      track.style.transform = `translateY(${endY}%)`;
      return;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (animRef.current) {
      animRef.current.onfinish = null;
      animRef.current.cancel();
      animRef.current = null;
    }
    track.style.transform = `translateY(${startY}%)`;
    const midY = startY + (endY - startY) * 0.1;
    const anim = track.animate(
      [
        { transform: `translateY(${startY}%)` },
        { transform: `translateY(${midY}%)`, offset: 0.5 },
        { transform: `translateY(${endY}%)` },
      ],
      { duration: TRANSITION_MS, easing: 'linear', fill: 'forwards' }
    );
    const delta = pendingDeltaRef.current;
    anim.onfinish = () => {
      if (!delta || animRef.current !== anim) return;
      if (typeof anim.commitStyles === 'function') {
        anim.commitStyles();
      }
      anim.onfinish = null;
      anim.cancel();
      animRef.current = null;
      animationFrameRef.current = requestAnimationFrame(() => {
        animationFrameRef.current = null;
        skipAnimRef.current = true;
        setCurrentPost((prev) => wrapIndex(prev + delta, POSTS.length));
        setLoopIndex(LOOP_CENTER);
        pendingDeltaRef.current = null;
      });
    };
    animRef.current = anim;

    return () => {
      if (animRef.current === anim) {
        anim.onfinish = null;
        anim.cancel();
        animRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [loopIndex]);

  const handleVideoClick = useCallback(() => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    setActionIcon(nextPlaying ? 'play' : 'pause');
    if (actionIconTimerRef.current) {
      clearTimeout(actionIconTimerRef.current);
    }
    actionIconTimerRef.current = setTimeout(() => {
      actionIconTimerRef.current = null;
      setActionIcon(null);
    }, 800);
  }, [isPlaying]);

  const handlePrev = useCallback(() => {
    queueMove(-1);
  }, [queueMove]);

  const handleNext = useCallback(() => {
    queueMove(1);
  }, [queueMove]);

  const handleWheel = useCallback((event) => {
    if (wheelLockRef.current) return;
    const deltaY = event.deltaY;
    if (!deltaY) return;
    event.preventDefault();
    if (deltaY > 0) {
      queueMove(1);
    } else {
      queueMove(-1);
    }
    wheelLockRef.current = true;
    if (wheelLockTimerRef.current) {
      clearTimeout(wheelLockTimerRef.current);
    }
    wheelLockTimerRef.current = setTimeout(() => {
      wheelLockTimerRef.current = null;
      wheelLockRef.current = false;
    }, 480);
  }, [queueMove]);

  const toggleLike = (index) => {
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-white font-sans text-[#161823]"
      style={{
        ...PREVIEW_PLATFORM_INTERACTION_STYLE,
        fontFamily: 'Proxima Nova, Arial, sans-serif',
      }}
    >
      <style>{`.tiktok-hide-scrollbar::-webkit-scrollbar { display: none; } .tiktok-hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      <header className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white z-30 shrink-0">
        <div className="flex items-center gap-2 cursor-pointer" style={ICON_STYLE}><TtIcon path={TT_ICONS.logo} className="h-8 w-8 text-black" /><span className="text-2xl font-bold tracking-tighter">{tt('brand')}</span></div>
        <div className="hidden md:flex flex-1 max-w-[500px] mx-4"><div className="flex flex-1 items-center bg-[#f1f1f2] rounded-full px-4 py-2 group focus-within:ring-1 focus-within:ring-gray-300"><input className="bg-transparent border-none outline-hidden text-sm w-full placeholder-[#757575]" placeholder={tt('header.search_placeholder')} /><div className="w-px h-4 bg-gray-300 mx-3"></div><TtIcon path={TT_ICONS.search} className="h-5 w-5 text-gray-500" /></div></div>
        <div className="flex items-center gap-4"><button className="flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-sm font-semibold text-sm" style={PREVIEW_PLATFORM_BUTTON_STYLE}><TtIcon path={TT_ICONS.add} className="h-5 w-5" /> {tt('header.upload')}</button><button className="bg-[#fe2c55] text-white px-6 py-1.5 rounded-sm font-bold text-sm hover:bg-[#ef2950]" style={PREVIEW_PLATFORM_BUTTON_STYLE}>{tt('header.login')}</button><TtIcon path={TT_ICONS.more} className="h-6 w-6 cursor-pointer text-black" /></div>
      </header>
      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex w-[240px] flex-col p-4 border-r border-gray-100 bg-white overflow-y-auto tiktok-hide-scrollbar">
          <div className="flex flex-col gap-1 mb-6">
            <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer text-[#fe2c55]"><TtIcon path={TT_ICONS.home} className="h-6 w-6" /><span className="font-bold text-lg">{tt('nav.for_you')}</span></div>
            <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer font-bold text-lg"><TtIcon path={TT_ICONS.friends} className="h-6 w-6" /><span>{tt('nav.following')}</span></div>
            <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer font-bold text-lg"><TtIcon path={TT_ICONS.live} className="h-6 w-6" /><span>{tt('nav.live')}</span></div>
          </div>
          <div className="pt-4 border-t border-gray-100">
            <p className="text-gray-500 text-xs font-semibold px-2 mb-4 uppercase">{tt('sidebar.suggested_accounts')}</p>
            {SUGGESTED_USERS.map((user, index) => (
              <div key={user.handle} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                <MockSurface hidden={surfaceHidden} className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-xs font-semibold text-white">
                  {avatarUrl ? (
                    <PreviewMediaImg className="w-full h-full object-cover" src={avatarUrl} alt={user.handle} />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${index === 0 ? 'bg-[#0ea5e9]' : index === 1 ? 'bg-[#8b5cf6]' : 'bg-[#ef4444]'}`}>
                      {user.handle.charAt(0).toUpperCase()}
                    </div>
                  )}
                </MockSurface>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold truncate">@{user.handle}</span>
                  <span className="text-xs text-gray-500 truncate">{user.name}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
        <main className="flex-1 relative bg-white flex justify-center overflow-hidden">
          <div className="h-full w-full max-w-[692px] overflow-hidden" onWheel={handleWheel}>
            <div
              ref={trackRef}
              className="flex flex-col"
              style={{
                height: `${LOOP_SIZE * 100}%`,
              }}
            >
              {Array.from({ length: LOOP_SIZE }, (_, slot) => {
                const idx = POSTS[wrapIndex(currentPost + slot - LOOP_CENTER, POSTS.length)];
                const isLiked = likedPosts.has(idx);
                const likeCount = parseInt(data.metrics.likes.replace(/,/g, '').replace(/K/g, '000')) + (isLiked ? 1 : 0);
                return (
                  <div
                    key={slot}
                    className="w-full flex flex-col pt-3 pb-6 border-b border-gray-100 shrink-0"
                    style={{ height: `${100 / LOOP_SIZE}%` }}
                  >
                    <div className="flex items-end gap-6 h-full min-h-0">
                      <div onClick={handleVideoClick} className="relative ml-20 h-full aspect-[9/16] bg-black rounded-lg overflow-hidden shadow-sm flex items-center justify-center group cursor-pointer">
                        {avatarUrl ? (
                          <PreviewMediaImg
                            className="absolute inset-0 h-full w-full object-cover"
                            alt={`${data.user} clip ${idx + 1}`}
                            src={avatarUrl}
                          />
                        ) : (
                          <div
                            className="absolute inset-0 opacity-90"
                            style={{
                              ...MEDIA_STYLE,
                              background: ['#1f3b99', '#a63d40', '#2f9e44'][idx % 3],
                              animation: 'none',
                            }}
                          />
                        )}
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundColor: ['rgba(4, 18, 58, 0.38)', 'rgba(72, 12, 24, 0.34)', 'rgba(7, 41, 23, 0.34)'][idx % 3],
                          }}
                        />
                        <style>{`@keyframes tiktokGradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } } @keyframes iconFade { 0% { transform: scale(0.5); opacity: 0; } 30% { transform: scale(1.1); opacity: 0.8; } 100% { transform: scale(1.2); opacity: 0; } } .animate-icon-fade { animation: iconFade 0.8s ease-out forwards; }`}</style>
                        <div className="absolute bottom-5 left-4 right-4 space-y-1 text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)]">
                          <div className="text-sm font-bold">{data.user} #{idx + 1}</div>
                          <PreviewText isDynamic className="text-xs font-semibold text-white/90 truncate">
                            {captionText} #focus #entropy #{idx + 1}
                          </PreviewText>
                          <MockSurface hidden={surfaceHidden} className="flex items-center gap-1 text-[11px] font-semibold text-white/80" style={ICON_STYLE}>
                            <TtIcon path={TT_ICONS.music} className="h-3.5 w-3.5" />
                            <span className="truncate">{data.music}</span>
                          </MockSurface>
                          <div className="text-[11px] font-semibold text-white/70">
                            <MockMetric kind="exposure" hidden={hiddenMetrics.viewCounts}>{data.metrics.views}</MockMetric>
                          </div>
                        </div>
                        {actionIcon && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"><div className="bg-black/40 rounded-full p-6 animate-icon-fade">{actionIcon === 'play' ? <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> : <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>}</div></div>}
                        {!isPlaying && <div className="absolute bottom-4 right-4 text-white/80"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20"><div className="h-full bg-[#FE2C55]" style={{ ...PREVIEW_PLATFORM_PROGRESS_STYLE, width: isPlaying ? '65%' : '35%' }} /></div>
                      </div>
                      <div className="flex flex-col gap-4 pb-2">
                        <div className="relative mb-2"><MockSurface hidden={surfaceHidden} className="w-12 h-12 rounded-full bg-gray-200 border border-gray-100 overflow-hidden cursor-pointer"><PreviewMediaImg className="w-full h-full object-cover" src={avatarUrl} /></MockSurface><MockSurface hidden={surfaceHidden}><button className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-[#FE2C55] rounded-full flex items-center justify-center text-white border-2 border-white" title={tt('actions.follow')} style={{ ...PREVIEW_PLATFORM_BUTTON_STYLE, ...ICON_STYLE }}><TtIcon path={TT_ICONS.add} className="h-3 w-3" /></button></MockSurface></div>
                        <div className="flex flex-col items-center gap-0"><MockSurface hidden={surfaceHidden}><button onClick={() => toggleLike(idx)} className={`w-12 h-12 rounded-full bg-[#f1f1f2] flex items-center justify-center hover:bg-[#e1e1e2] ${isLiked ? 'text-[#FE2C55]' : 'text-black'}`} style={{ ...PREVIEW_PLATFORM_BUTTON_STYLE, ...ICON_STYLE }}><TtIcon path={isLiked ? TT_ICONS.heartFilled : TT_ICONS.heart} className="h-6 w-6" /></button></MockSurface><span className="text-xs font-bold text-gray-500"><MockMetric kind="engagement" hidden={hiddenMetrics.engagement}>{likeCount >= 1000 ? (likeCount / 1000).toFixed(1) + 'K' : likeCount}</MockMetric></span></div>
                        <div className="flex flex-col items-center gap-0"><MockSurface hidden={surfaceHidden}><button className="w-12 h-12 rounded-full bg-[#f1f1f2] flex items-center justify-center hover:bg-[#e1e1e2] text-black" style={{ ...PREVIEW_PLATFORM_BUTTON_STYLE, ...ICON_STYLE }}><TtIcon path={TT_ICONS.comment} className="h-6 w-6" /></button></MockSurface><span className="text-xs font-bold text-gray-500"><MockMetric kind="engagement" hidden={hiddenMetrics.engagement}>{data.metrics.comments}</MockMetric></span></div>
                        <div className="flex flex-col items-center gap-0"><MockSurface hidden={surfaceHidden}><button className="w-12 h-12 rounded-full bg-[#f1f1f2] flex items-center justify-center hover:bg-[#e1e1e2] text-black" style={{ ...PREVIEW_PLATFORM_BUTTON_STYLE, ...ICON_STYLE }}><TtIcon path={TT_ICONS.bookmark} className="h-6 w-6" /></button></MockSurface><span className="text-xs font-bold text-gray-500"><MockMetric kind="engagement" hidden={hiddenMetrics.engagement}>{data.metrics.bookmarks}</MockMetric></span></div>
                        <div className="flex flex-col items-center gap-0"><MockSurface hidden={surfaceHidden}><button className="w-12 h-12 rounded-full bg-[#f1f1f2] flex items-center justify-center hover:bg-[#e1e1e2] text-black" style={{ ...PREVIEW_PLATFORM_BUTTON_STYLE, ...ICON_STYLE }}><TtIcon path={TT_ICONS.share} className="h-6 w-6" /></button></MockSurface><span className="text-xs font-bold text-gray-500"><MockMetric kind="engagement" hidden={hiddenMetrics.engagement}>{data.metrics.shares}</MockMetric></span></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
      <div className="fixed right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-2 xl:flex z-50">
        <button
          type="button"
          onClick={handlePrev}
          className="h-10 w-10 rounded-full border border-gray-200 bg-white text-black shadow-lg flex items-center justify-center hover:bg-gray-100 hover:shadow-xl"
          aria-label={tt('aria.previous_video')}
          style={{ ...PREVIEW_PLATFORM_BUTTON_STYLE, ...ICON_STYLE }}
        >
          <TtIcon path={TT_ICONS.arrowUp} className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="h-10 w-10 rounded-full border border-gray-100 bg-white text-black shadow-lg flex items-center justify-center hover:bg-gray-100 hover:shadow-xl"
          aria-label={tt('aria.next_video')}
          style={{ ...PREVIEW_PLATFORM_BUTTON_STYLE, ...ICON_STYLE }}
        >
          <TtIcon path={TT_ICONS.arrowDown} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
