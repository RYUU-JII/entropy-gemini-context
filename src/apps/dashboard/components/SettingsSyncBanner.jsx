import React from 'react';

const TONE_CLASS_MAP = Object.freeze({
  saving: {
    shell: 'border-[#C5A059]/30 bg-[#C5A059]/8 text-[#8A6416]',
    dot: 'bg-[#C5A059]',
    detail: 'text-[#8A6416]/75',
  },
  success: {
    shell: 'border-[#2D4F1E]/20 bg-[#2D4F1E]/6 text-[#2D4F1E]',
    dot: 'bg-[#2D4F1E]',
    detail: 'text-[#2D4F1E]/70',
  },
  error: {
    shell: 'border-[#B22222]/25 bg-[#B22222]/8 text-[#7A1A1A]',
    dot: 'bg-[#B22222]',
    detail: 'text-[#7A1A1A]/75',
  },
});

export default function SettingsSyncBanner({ notice, className = '' }) {
  if (!notice?.message) return null;

  const tone = TONE_CLASS_MAP[notice.tone] || TONE_CLASS_MAP.success;
  const shellClassName = className
    ? `${className} ${tone.shell}`
    : tone.shell;

  return (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`rounded-none border px-4 py-3 ${shellClassName}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 ${tone.dot}`} />
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.1em]">
            {notice.message}
          </div>
          {notice.detail && (
            <div className={`mt-1 break-words text-[10px] font-semibold uppercase tracking-[0.08em] ${tone.detail}`}>
              {notice.detail}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
