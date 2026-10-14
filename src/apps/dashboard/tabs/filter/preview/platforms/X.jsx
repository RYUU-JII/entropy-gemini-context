import React, { useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { resolveAssetUrl } from '../../../../../../domains/settings/config/settingsPreviewConfig.js';
import { MOCK_PLATFORM_DATA } from '../constants.js';
import { PreviewText, PreviewMediaImg, MockMetric, MockSurface, MEDIA_STYLE, ICON_STYLE } from '@/themes/core/widgets/shared/preview/Common.jsx';

const X_ICONS = {
  logo: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  home: 'M22 9.68l-1.32-.82L12 1.7 3.32 8.86 2 9.68V19.5c0 1.38 1.12 2.5 2.5 2.5h15c1.38 0 2.5-1.12 2.5-2.5V9.68zM12 16.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z',
  search: 'M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.684 3.815-1.817 5.269l5.454 5.454-1.414 1.414-5.454-5.454c-1.454 1.133-3.283 1.817-5.269 1.817-4.694 0-8.5-3.806-8.5-8.5z',
  notification: 'M21.697 16.468c-.02-.016-2.14-1.64-2.103-6.03.02-2.532-.812-4.982-2.347-6.888-1.515-1.88-3.61-2.971-5.9-3.05V.5h-1v.05c-2.419.133-4.587 1.348-6.092 3.391-1.502 2.039-2.287 4.572-2.209 7.138-.037 4.394-2.02 6.086-2.04 6.102l-.698.564V20h23.384v-2.155l-.698-.564zM12.75 22.5c-.649 0-1.27-.262-1.72-.715-.448-.453-.702-1.076-.702-1.735h4.844c0 .66-.254 1.282-.702 1.735-.449.453-1.071.715-1.72.715z',
  message: 'M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v2.764l8 3.638 8-3.636V5.5c0-.276-.224-.5-.5-.5h-15zm15.5 5.463l-8 3.636-8-3.638V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.037z',
  reply: 'M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z',
  repost: 'M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z',
  like: 'M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.605 3.01.894 1.81.844 4.17-.518 6.67z',
  views: 'M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z',
  share: 'M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z',
  verified: 'M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.02-3.01-1.09-3.97-1.1-.96-2.73-1.07-3.96-.26-1.06-1.03-2.71-1.39-.87-1.3-.52-2.95-.16-4.01.87-1.23-.81-2.86-.7-3.96.26-1.11.96-1.55 2.58-1.09 3.97-1.3.67-2.19 1.91-2.19 3.34 0 1.43.88 2.67 2.19 3.34-.46 1.39-.02 3.01 1.09 3.97 1.1.96 2.73 1.07 3.96.26 1.06 1.03 2.71 1.39 4.01-.87 1.3.52 2.95.16 4.01-.87 1.23.81 2.86.7 3.96-.26 1.11-.96 1.55-2.58 1.09-3.97 1.3-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z',
  more: 'M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 17.5c-4.28 0-7.75-3.47-7.75-7.75S7.72 4.25 12 4.25s7.75 3.47 7.75 7.75-3.47 7.75-7.75 7.75zM12 10.5c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5-1.5-.672-1.5-1.5.672-1.5 1.5-1.5zm-4.5 0c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5-1.5-.672-1.5-1.5.672-1.5 1.5-1.5zm9 0c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5-1.5-.672-1.5-1.5.672-1.5 1.5-1.5z',
  profile: 'M17.863 13.44c1.476 1.58 2.333 3.635 2.333 5.875v1H3.804v-1c0-2.24.857-4.295 2.333-5.875 1.476-1.58 3.507-2.498 5.863-2.498s4.387.918 5.863 2.498zM12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z',
  bookmark: 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z',
};

function XIcon({ path, className = 'h-6 w-6', outlined = false, style }) {
  const safePath = typeof path === 'string' ? path.trim() : '';
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${outlined ? 'stroke-current' : 'fill-current'} ${className}`}
      style={{ minWidth: '24px', ...ICON_STYLE, ...style }}
      fill={outlined ? 'none' : 'currentColor'}
      stroke={outlined ? 'currentColor' : 'none'}
      strokeWidth={outlined ? 1.5 : undefined}
      strokeLinecap={outlined ? 'round' : undefined}
      strokeLinejoin={outlined ? 'round' : undefined}
    >
      {safePath ? <path d={safePath} /> : null}
    </svg>
  );
}

function XMediaCard({ src, label, badgeLabel, surfaceHidden = false }) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-[#f2f5f7]">
      <div className="relative aspect-[16/9]">
        {src ? (
          <PreviewMediaImg className="h-full w-full object-cover" src={src} alt={label} />
        ) : (
          <div className="h-full w-full bg-[#d7e0e7]" style={MEDIA_STYLE} />
        )}
        <MockSurface
          hidden={surfaceHidden}
          className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0f1419]"
        >
          {badgeLabel}
        </MockSurface>
        <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
          {label}
        </div>
      </div>
    </div>
  );
}

export default function MockX({ variant, baseText, hiddenMetrics, surfaceState }) {
  const { t } = useAppTranslation('settings');
  const tx = (key) => t(`preview.x.${key}`);
  const data = MOCK_PLATFORM_DATA.x;
  const avatarUrl = variant?.url ? resolveAssetUrl(variant.url) : '';
  const surfaceHidden = surfaceState?.socialSurface === true;
  const [inputText, setInputText] = useState('');
  const postText = baseText || MOCK_PLATFORM_DATA.defaults.captionFallback;
  const posts = [
    {
      id: 0,
      text: postText,
      time: data.time,
      metrics: data.metrics,
      mediaLabel: tx('media.preview_asset'),
    },
    {
      id: 1,
      text: '목업은 패러디 톤을 유지하되, 텍스트 간격과 버튼 밀도만 정리해도 체감 품질이 꽤 올라간다.',
      time: '2h',
      metrics: {
        replies: '31',
        reposts: '88',
        likes: '1.9K',
        views: '15K',
      },
    },
    {
      id: 2,
      text: '지나치게 번쩍이는 재해석보다 원본 실루엣을 닮은 가짜가 훨씬 설득력 있다. 이건 그 확인용 피드.',
      time: '4h',
      metrics: {
        replies: '19',
        reposts: '54',
        likes: '1.1K',
        views: '9.6K',
      },
    },
    {
      id: 3,
      text: '필터 테스트에서는 텍스트, 아이콘, 메트릭이 각각 또렷하게 남아 있어야 한다. 그래서 구조는 최대한 그대로 둔다.',
      time: '7h',
      metrics: {
        replies: '12',
        reposts: '33',
        likes: '742',
        views: '6.3K',
      },
    },
  ];

  return (
    <div className="flex h-full w-full bg-white text-[#0f1419] font-sans shadow-sm border border-gray-200 overflow-y-auto fr-scroll relative scroll-smooth" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <style>{`.x-hide-scrollbar::-webkit-scrollbar { display: none; } .x-hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      {/* Sidebar */}
      <div className="sticky top-0 h-full w-[60px] xl:w-[200px] flex flex-col items-end xl:items-start px-2 pt-2 pb-0 border-r border-gray-100 shrink-0 overflow-y-auto x-hide-scrollbar bg-white z-20">
        <div className="p-3 rounded-full hover:bg-gray-100 cursor-pointer mb-1">
          <XIcon path={X_ICONS.logo} className="h-7 w-7" />
        </div>
        <div className="flex flex-col gap-1 w-full">
          {[
            { icon: X_ICONS.home, label: tx('nav.home'), active: true },
            { icon: X_ICONS.search, label: tx('nav.explore') },
            { icon: X_ICONS.notification, label: tx('nav.notifications'), outlined: true },
            { icon: X_ICONS.message, label: tx('nav.messages') },
            { icon: X_ICONS.profile, label: tx('nav.profile'), outlined: true },
            { icon: X_ICONS.more, label: tx('nav.more') },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-full hover:bg-gray-100 cursor-pointer w-max xl:w-full">
              <XIcon
                path={item.icon}
                outlined={item.outlined}
                className={`h-7 w-7 ${item.outlined ? 'text-black' : ''} ${item.active ? 'font-bold' : ''}`}
              />
              <span className={`hidden xl:block text-xl ${item.active ? 'font-bold' : 'font-normal'}`}>{item.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 w-12 h-12 xl:w-[90%] xl:h-12 bg-[#0f1419] rounded-full flex items-center justify-center text-white font-bold text-lg cursor-pointer hover:bg-black/90">
          <span className="hidden xl:block">{tx('compose.post')}</span>
          <span className="xl:hidden">+</span>
        </div>
        <div className="mt-auto mb-2 flex items-center gap-3 p-3 rounded-full hover:bg-gray-100 cursor-pointer w-max xl:w-full">
          <MockSurface hidden={surfaceHidden} className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
            <PreviewMediaImg className="w-full h-full object-cover" src={avatarUrl} />
          </MockSurface>
          <div className="hidden xl:flex flex-col">
            <span className="font-bold text-sm">{data.name}</span>
            <span className="text-gray-500 text-sm">{data.handle}</span>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 flex flex-col min-w-0 h-max">
        <div className="flex-1 flex flex-col">
          <div className="h-[53px] border-b border-gray-100 flex items-center bg-white/75 backdrop-blur-md sticky top-0 z-10 shrink-0">
            <div className="flex-1 h-full flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-black/[0.03] relative">
              {tx('tabs.for_you')}
              <div className="absolute bottom-0 w-14 h-1 bg-[#1d9bf0] rounded-full"></div>
            </div>
            <div className="flex-1 h-full flex items-center justify-center font-medium text-gray-500 text-sm cursor-pointer hover:bg-black/[0.03]">{tx('tabs.following')}</div>
          </div>
          <div className="border-b border-gray-100 px-4 pt-4 pb-2 bg-white">
            <div className="flex gap-3">
              <div className="w-11 h-11 rounded-full bg-gray-200 overflow-hidden shrink-0">
                <PreviewMediaImg className="w-full h-full object-cover" src={avatarUrl} />
              </div>
              <div className="flex-1">
                <input
                  className="w-full text-[15px] placeholder-[#536471] text-[#0f1419] bg-transparent outline-hidden mt-2"
                  placeholder={tx('compose.placeholder')}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#1d9bf0]">
                    {[X_ICONS.reply, X_ICONS.repost, X_ICONS.like, X_ICONS.share].map((icon, index) => (
                      <button
                        key={index}
                        className="p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors"
                        type="button"
                      >
                        <XIcon path={icon} className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                  <button
                    className={`h-9 px-4 rounded-full text-sm font-bold transition-colors ${inputText.trim() ? 'bg-[#0f1419] text-white hover:bg-black/90' : 'bg-[#eff3f4] text-[#8b98a5] cursor-default'}`}
                    type="button"
                  >
                    {tx('compose.post')}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {posts.map((post) => (
            <article key={post.id} className="flex gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
              <div className="shrink-0">
                <MockSurface hidden={surfaceHidden} className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                  <PreviewMediaImg className="w-full h-full object-cover" src={avatarUrl} />
                </MockSurface>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-[15px]">
                  <span className="font-bold text-[#0f1419]">{data.name}</span>
                  <MockSurface as="span" hidden={surfaceHidden} className="inline-flex">
                    <XIcon path={X_ICONS.verified} className="h-4 w-4 text-[#1d9bf0]" />
                  </MockSurface>
                  <span className="text-[#536471]">{data.handle}</span>
                  <span className="text-[#536471]">·</span>
                  <span className="text-[#536471] hover:underline">
                    <MockMetric kind="exposure" hidden={hiddenMetrics.timeSignals}>{post.time}</MockMetric>
                  </span>
                </div>
                <PreviewText
                  className="text-[15px] leading-normal text-[#0f1419] mt-1 whitespace-pre-wrap break-words"
                  isDynamic
                >
                  {post.text}
                </PreviewText>
                {post.mediaLabel ? <XMediaCard src={avatarUrl} label={post.mediaLabel} badgeLabel={tx('media.badge')} surfaceHidden={surfaceHidden} /> : null}
                <div className="flex items-center justify-between mt-3 w-full text-[#536471]">
                  <div className="flex items-center justify-between flex-1 max-w-[320px]">
                    <div className="flex items-center gap-0 group cursor-pointer hover:text-[#1d9bf0]">
                      <MockSurface hidden={surfaceHidden} className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10">
                        <XIcon path={X_ICONS.reply} className="h-[18px] w-[18px]" />
                      </MockSurface>
                      <span className="text-xs -ml-1"><MockMetric kind="engagement" hidden={hiddenMetrics.engagement}>{post.metrics.replies}</MockMetric></span>
                    </div>
                    <div className="flex items-center gap-0 group cursor-pointer hover:text-[#00ba7c]">
                      <MockSurface hidden={surfaceHidden} className="p-2 rounded-full group-hover:bg-[#00ba7c]/10">
                        <XIcon path={X_ICONS.repost} className="h-[18px] w-[18px]" />
                      </MockSurface>
                      <span className="text-xs -ml-1"><MockMetric kind="engagement" hidden={hiddenMetrics.engagement}>{post.metrics.reposts}</MockMetric></span>
                    </div>
                    <div className="flex items-center gap-0 group cursor-pointer hover:text-[#f91880]">
                      <MockSurface hidden={surfaceHidden} className="p-2 rounded-full group-hover:bg-[#f91880]/10">
                        <XIcon path={X_ICONS.like} className="h-[18px] w-[18px]" />
                      </MockSurface>
                      <span className="text-xs -ml-1"><MockMetric kind="engagement" hidden={hiddenMetrics.engagement}>{post.metrics.likes}</MockMetric></span>
                    </div>
                    <div className="flex items-center gap-0 group cursor-pointer hover:text-[#1d9bf0]">
                      <MockSurface hidden={surfaceHidden} className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10">
                        <XIcon path={X_ICONS.views} className="h-[18px] w-[18px]" />
                      </MockSurface>
                      <span className="text-xs -ml-1"><MockMetric kind="exposure" hidden={hiddenMetrics.viewCounts}>{post.metrics.views}</MockMetric></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 group cursor-pointer hover:text-[#1d9bf0]">
                      <MockSurface hidden={surfaceHidden} className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10">
                        <XIcon path={X_ICONS.bookmark} className="h-[18px] w-[18px]" />
                      </MockSurface>
                    </div>
                    <div className="flex items-center gap-1 group cursor-pointer hover:text-[#1d9bf0]">
                      <MockSurface hidden={surfaceHidden} className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10">
                        <XIcon path={X_ICONS.share} className="h-[18px] w-[18px]" />
                      </MockSurface>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Right Sidebar (Trends) */}
      <div className="sticky top-0 h-full hidden lg:flex w-[210px] xl:w-[230px] flex-col gap-4 px-4 pt-2 pb-0 border-l border-gray-100 shrink-0 overflow-y-auto x-hide-scrollbar bg-white z-20">
        <div className="sticky top-0 bg-white z-10 py-1">
          <div className="flex items-center bg-[#eff3f4] rounded-full px-4 h-[42px] group focus-within:bg-white focus-within:ring-1 focus-within:ring-[#1d9bf0]">
            <XIcon path={X_ICONS.search} className="h-5 w-5 text-[#536471] group-focus-within:text-[#1d9bf0]" />
            <input className="bg-transparent border-none outline-hidden ml-3 text-[15px] placeholder-[#536471] w-full" placeholder={tx('search.placeholder')} />
          </div>
        </div>

        <div className="bg-[#f7f9f9] rounded-2xl flex flex-col overflow-hidden">
          <h2 className="font-extrabold text-xl px-4 py-3">{tx('trends.title')}</h2>
          {data.trends.map((trend, i) => (
            <div key={i} className="px-4 py-3 hover:bg-[#eff3f4] cursor-pointer transition-colors relative">
              <div className="text-xs text-[#536471] flex justify-between">
                <span>{trend.category}</span>
                <XIcon path={X_ICONS.more} className="h-4 w-4 text-[#536471]" />
              </div>
              <div className="font-bold text-[15px] mt-0.5">{trend.name}</div>
              <div className="text-xs text-[#536471] mt-0.5">{trend.posts}</div>
            </div>
          ))}
          <div className="px-4 py-3 text-[#1d9bf0] text-[15px] hover:bg-[#eff3f4] cursor-pointer">{tx('trends.show_more')}</div>
        </div>
      </div>
    </div>
  );
}
