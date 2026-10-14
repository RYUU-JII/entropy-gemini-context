import React, { useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { resolveAssetUrl } from '../../../../../../domains/settings/config/settingsPreviewConfig.js';
import { MOCK_PLATFORM_DATA } from '../constants.js';
import { PreviewText, PreviewMediaImg, MockMetric, MockSurface, MEDIA_STYLE, ICON_STYLE } from '@/themes/core/widgets/shared/preview/Common.jsx';

const YT_ICONS = {
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  mic: 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zM17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z',
  create: 'M14 13h-3v3H9v-3H6v-2h3V8h2v3h3v2zM19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  bell: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z',
  like: 'M18.77,11h-4.23l1.52-4.94C16.38,5.03,15.54,4,14.38,4c-0.58,0-1.14,0.24-1.52,0.65L7,11H3v10h4h1h9.43 c1.06,0,1.98-0.67,2.19-1.61l1.34-6C21.23,12.15,20.18,11,18.77,11z M7,20H4v-8h3V20z M19.98,13.17l-1.34,6 C18.54,19.65,18.03,20,17.43,20H8v-8.61l5.6-6.06C13.79,5.12,14.08,5,14.38,5c0.26,0,0.5,0.11,0.63,0.3 c0.07,0.1,0.15,0.26,0.09,0.47l-1.52,4.94L13.18,12h1.35h4.23c0.41,0,0.8,0.17,1.03,0.46C19.92,12.61,20.05,12.86,19.98,13.17z',
  likeFilled: 'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z',
  share: 'M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z',
  download: 'M17 13l-5 5-5-5h3V9h4v4h3zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  sort: 'M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z',
  expand: 'M12 15.41l-6-6L7.41 8 12 12.58l4.59-4.58L18 9.41l-6 6z',
  delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  emoji: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z',
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  volume: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  fullscreen: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
  cc: 'M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z',
};

const AVATAR_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'];
const COMMENT_EMOJIS = ['🔥', '👏', '👍', '✨', '👀', '🎯'];

const parseLikes = (val) => {
  if (typeof val === 'number') return val;
  const str = String(val).replace(/,/g, '').trim();
  if (str.includes('천')) return parseFloat(str) * 1000;
  if (str.includes('만')) return parseFloat(str) * 10000;
  if (str.includes('K')) return parseFloat(str) * 1000;
  return parseInt(str, 10) || 0;
};

const formatLikes = (num) => {
  return num.toLocaleString();
};

function YoutubeIcon({ path, className = 'h-6 w-6', style }) {
  const safePath = typeof path === 'string' ? path.trim() : '';
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} style={{ minWidth: '24px', ...ICON_STYLE, ...style }}>
      {safePath ? <path d={safePath} /> : null}
    </svg>
  );
}

function PreviewThumb({ src, alt, className = 'h-full w-full object-cover', fallbackClassName = 'bg-gray-200', fallbackLabel }) {
  if (src) {
    return <PreviewMediaImg className={className} src={src} alt={alt} />;
  }

  return (
      <div className={`h-full w-full ${fallbackClassName}`}>
      <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
        {fallbackLabel}
      </div>
    </div>
  );
}

function Comment({ data, isReply = false, channelName, onReply, onDelete, onLike, onDislike, t, surfaceHidden = false }) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(true);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const handleSubmitReply = () => {
    if (!replyText.trim()) return;
    onReply(data.id, replyText);
    setReplyText('');
    setIsReplying(false);
    setShowReplies(true);
  };

  return (
    <div className="flex gap-4">
      <MockSurface
        hidden={surfaceHidden}
        className={`${isReply ? 'w-6 h-6 text-[10px]' : 'w-10 h-10 text-sm'} rounded-full ${data.avatarColor || 'bg-gray-200'} text-white flex items-center justify-center shrink-0 font-medium`}
      >
        {data.user.charAt(0).toUpperCase()}
      </MockSurface>
      <div className="flex flex-col gap-1 flex-1">
        <div className="flex items-center gap-2 text-xs mb-0.5">
          <span className={`font-bold cursor-pointer ${data.user === channelName ? 'bg-[#606060] text-white px-2 py-0.5 rounded-full text-[10px]' : 'text-[#0f0f0f]'}`}>
            {data.user === channelName ? data.user : (isReply ? data.user : `@${data.user}`)}
          </span>
          <span className="text-[#606060]">{data.time}</span>
        </div>
        <PreviewText className="text-sm text-[#0f0f0f] leading-normal">{data.text}</PreviewText>
          <div className="flex items-center gap-4 text-xs text-[#0f0f0f] mt-1">
            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onLike(data.id)}>
              <MockSurface as="span" hidden={surfaceHidden} className="inline-flex">
                <YoutubeIcon path={data.isLiked ? YT_ICONS.likeFilled : YT_ICONS.like} className="h-4 w-4" />
              </MockSurface>
              <span className="text-[#606060]">{formatLikes(data.likes)}</span>
            </div>
            <div className="cursor-pointer" onClick={() => onDislike(data.id)}>
              <MockSurface as="span" hidden={surfaceHidden} className="inline-flex">
                <YoutubeIcon path={data.isDisliked ? YT_ICONS.likeFilled : YT_ICONS.like} className="h-4 w-4" style={{ transform: 'scaleY(-1)' }} />
              </MockSurface>
            </div>
          {!isReply && (
            <span className="font-medium text-xs cursor-pointer hover:bg-gray-100 px-2 py-1 rounded-full" onClick={() => setIsReplying(!isReplying)}>
              {t('preview.youtube.actions.reply', { })}
            </span>
          )}
          {data.isMine && (
            <div className="cursor-pointer hover:bg-gray-100 p-1 rounded-full" onClick={() => onDelete(data.id)} title={t('preview.youtube.actions.delete', { })}>
              <YoutubeIcon path={YT_ICONS.delete} className="h-4 w-4 text-gray-500" />
            </div>
          )}
        </div>
        {isReplying && (
          <div className="flex gap-3 mt-3 mb-2">
            <div className="w-6 h-6 rounded-full bg-purple-700 text-white flex items-center justify-center text-[10px] shrink-0">M</div>
            <div className="flex-1 flex flex-col gap-2">
                <input
                  className="w-full text-sm outline-hidden border-b border-gray-200 pb-1 focus:border-black transition-colors placeholder-gray-500 bg-transparent"
                  placeholder={t('preview.youtube.actions.add_reply_placeholder', { })}
                  autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitReply();
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <div className="relative">
                  <button
                    className="text-gray-400 hover:text-black transition-colors"
                    onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                  >
                    <YoutubeIcon path={YT_ICONS.emoji} className="h-5 w-5" />
                  </button>
                  {isEmojiPickerOpen && (
                    <div className="absolute left-0 top-full mt-1 p-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 flex gap-0.5">
                      {COMMENT_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          className="hover:bg-gray-100 p-1 rounded text-base"
                          onClick={() => { setReplyText(prev => prev + emoji); setIsEmojiPickerOpen(false); }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsReplying(false)} className="px-3 py-1.5 text-xs font-medium hover:bg-gray-100 rounded-full transition-colors">{t('preview.youtube.actions.cancel', { })}</button>
                  <button onClick={handleSubmitReply} disabled={!replyText.trim()} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${replyText.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400'}`}>{t('preview.youtube.actions.reply', { })}</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {!isReply && data.replies && data.replies.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2 text-[#065fd4] text-sm font-medium cursor-pointer mb-2" onClick={() => setShowReplies(!showReplies)}>
              <YoutubeIcon path={YT_ICONS.expand} className={`h-4 w-4 ${showReplies ? 'rotate-180' : ''}`} />
              {t('preview.youtube.comments.replies_count', { count: data.replies.length })}
            </div>
            {showReplies && (
              <div className="flex flex-col gap-4">
                {data.replies.map((reply, j) => (
                  <Comment
                    key={reply.id}
                    data={reply}
                    isReply
                    channelName={channelName}
                    onDelete={onDelete}
                    onLike={onLike}
                    onDislike={onDislike}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MockYoutube({ variant, baseText, hiddenMetrics, surfaceState }) {
  const { t } = useAppTranslation('settings');
  const yt = (key, options = {}) => t(`preview.youtube.${key}`, options);
  const data = MOCK_PLATFORM_DATA.youtube;
  const heroAssetUrl = variant?.url ? resolveAssetUrl(variant.url) : '';
  const description = baseText || data.description;
  const surfaceHidden = surfaceState?.socialSurface === true;
  const [comments, setComments] = useState(() => data.comments.map((comment, index) => ({
    ...comment,
    id: `comment-${index}`,
    likes: parseLikes(comment.likes),
    replies: (comment.replies || []).map((reply, replyIndex) => ({
      ...reply,
      id: `comment-${index}-reply-${replyIndex}`,
      likes: parseLikes(reply.likes),
    })),
  })));
  const [sortMode, setSortMode] = useState('top');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [subscribed, setSubscribed] = useState(false);

  const ytText = (key, options = {}) => {
    const normalizedKey = key.startsWith('preview.youtube.') ? key.slice('preview.youtube.'.length) : key;
    return yt(normalizedKey, options);
  };

  const handleReply = (commentId, replyText) => {
    setComments((prev) => prev.map((comment) => {
      if (comment.id !== commentId) return comment;
      const nextReplies = [...(comment.replies || []), {
        id: `${comment.id}-reply-${Date.now()}`,
        user: data.channel,
        text: replyText,
        likes: 0,
        isMine: true,
        time: yt('comments.just_now'),
      }];
      return { ...comment, replies: nextReplies };
    }));
  };

  const handleDelete = (commentId) => {
    setDeleteTarget(commentId);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setComments((prev) => prev.filter((comment) => comment.id !== deleteTarget));
    setDeleteTarget(null);
  };

  const handleLike = (commentId) => {
    setComments((prev) => prev.map((comment) => {
      if (comment.id === commentId) {
        const isLiked = !comment.isLiked;
        return {
          ...comment,
          isLiked,
          likes: Math.max(0, Number(comment.likes || 0) + (isLiked ? 1 : -1)),
        };
      }
      return {
        ...comment,
        replies: (comment.replies || []).map((reply) => (
          reply.id === commentId
            ? {
                ...reply,
                isLiked: !reply.isLiked,
                likes: Math.max(0, Number(reply.likes || 0) + (!reply.isLiked ? 1 : -1)),
              }
            : reply
        )),
      };
    }));
  };

  const handleDislike = (commentId) => {
    setComments((prev) => prev.map((comment) => {
      if (comment.id === commentId) {
        return { ...comment, isDisliked: !comment.isDisliked };
      }
      return {
        ...comment,
        replies: (comment.replies || []).map((reply) => (
          reply.id === commentId ? { ...reply, isDisliked: !reply.isDisliked } : reply
        )),
      };
    }));
  };

  const sortedComments = [...comments].sort((left, right) => {
    if (sortMode === 'newest') {
      return right.id.localeCompare(left.id);
    }
    return Number(right.likes || 0) - Number(left.likes || 0);
  });

  return (
    <div
      className="flex h-full w-full overflow-y-auto bg-[#0f0f0f] text-white"
      style={{ fontFamily: 'Roboto, Arial, sans-serif' }}
    >
      <div className="mx-auto flex w-full max-w-[1400px] flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-white/10 bg-[#0f0f0f]/95 px-4 backdrop-blur">
          <button type="button" className="rounded-full p-2 hover:bg-white/10">
            <YoutubeIcon path={YT_ICONS.menu} className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-lg font-bold">
            <span className="rounded bg-[#ff0033] px-2 py-0.5 text-xs font-black uppercase tracking-[0.18em]">{yt('shared.preview')}</span>
            <span>{data.channel}</span>
          </div>
          <div className="mx-auto flex w-full max-w-[560px] items-center rounded-full border border-white/15 bg-[#121212] px-4 py-2">
            <input
              className="w-full bg-transparent text-sm text-white outline-hidden placeholder:text-white/45"
              placeholder={yt('search.placeholder')}
            />
            <YoutubeIcon path={YT_ICONS.search} className="h-5 w-5 text-white/65" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="rounded-full border border-white/10 px-3 py-2 text-sm hover:bg-white/10">
              {yt('actions.save_offline')}
            </button>
          </div>
        </header>

        <div className="flex flex-1 gap-6 px-4 py-5 lg:px-6">
          <main className="min-w-0 flex-1">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
              {heroAssetUrl ? (
                <PreviewMediaImg className="aspect-video w-full object-cover" src={heroAssetUrl} alt={data.title} />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-[#1f1f1f]" style={MEDIA_STYLE}>
                  <YoutubeIcon path={YT_ICONS.play} className="h-20 w-20 text-white/70" />
                </div>
              )}
            </div>

            <div className="mt-5">
              <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/65">
                <span><MockMetric kind="exposure" hidden={hiddenMetrics.viewCounts}>{data.views}</MockMetric></span>
                <span>•</span>
                <span><MockMetric kind="exposure" hidden={hiddenMetrics.timeSignals}>{data.age}</MockMetric></span>
                <span>•</span>
                <span>{data.duration}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="flex items-center gap-3">
                <MockSurface hidden={surfaceHidden} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8b5cf6] text-sm font-bold">
                  {data.channel.charAt(0).toUpperCase()}
                </MockSurface>
                <div>
                  <div className="font-semibold">{data.channel}</div>
                  <div className="text-sm text-white/55">
                    <MockMetric kind="engagement" hidden={hiddenMetrics.audienceCounts}>{data.subscribers}</MockMetric>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubscribed((prev) => !prev)}
                  className={`ml-2 rounded-full px-4 py-2 text-sm font-semibold ${subscribed ? 'bg-white/10 text-white' : 'bg-white text-black'}`}
                >
                  {subscribed ? yt('actions.subscribed') : yt('actions.subscribe')}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10">
                  {yt('actions.share')}
                </button>
                <button type="button" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10">
                  {yt('actions.comment')}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-relaxed text-white/78">
              <PreviewText isDynamic>{description}</PreviewText>
            </div>

            <div className="mt-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{yt('comments.total_count', { count: comments.length })}</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSortMode('top')}
                    className={`rounded-full px-3 py-1.5 text-sm ${sortMode === 'top' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                  >
                    {yt('comments.sort_top')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortMode('newest')}
                    className={`rounded-full px-3 py-1.5 text-sm ${sortMode === 'newest' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                  >
                    {yt('comments.sort_newest')}
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {sortedComments.map((comment) => (
                  <Comment
                    key={comment.id}
                    data={comment}
                    channelName={data.channel}
                    onReply={handleReply}
                    onDelete={handleDelete}
                    onLike={handleLike}
                    onDislike={handleDislike}
                    t={ytText}
                    surfaceHidden={surfaceHidden}
                  />
                ))}
              </div>
            </div>
          </main>

          <aside className="hidden w-[360px] shrink-0 xl:block">
            <div className="sticky top-20 space-y-3">
              {data.recommendations.map((item, index) => (
                <div key={`${item.title}-${index}`} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="relative h-[94px] w-[168px] shrink-0 overflow-hidden rounded-xl bg-white/10">
                    {heroAssetUrl ? (
                      <PreviewMediaImg className="h-full w-full object-cover" src={heroAssetUrl} alt={item.title} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-white/5">
                        <YoutubeIcon path={YT_ICONS.play} className="h-8 w-8 text-white/50" />
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold">
                      {item.duration}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</div>
                    <div className="mt-1 text-xs text-white/60">{item.channel}</div>
                    <div className="mt-1 text-xs text-white/45">{item.views}</div>
                    <div className="text-xs text-white/45">{item.age}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        {deleteTarget ? (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#181818] p-5">
              <div className="text-lg font-semibold">{yt('dialogs.delete_comment_title')}</div>
              <div className="mt-2 text-sm text-white/65">{yt('dialogs.delete_comment_body')}</div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-full px-4 py-2 text-sm text-white/75 hover:bg-white/10"
                >
                  {yt('actions.cancel')}
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
                >
                  {yt('actions.delete')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
