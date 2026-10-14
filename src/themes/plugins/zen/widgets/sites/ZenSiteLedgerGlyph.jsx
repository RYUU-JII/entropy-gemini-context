import React from 'react';

export default function ZenSiteLedgerGlyph({ kind }) {
  let mark;
  switch (kind) {
    case 'short_sessions':
      mark = <g fill="currentColor" stroke="none"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></g>;
      break;
    case 'long_sessions':
      mark = <path d="M2 8h12" />;
      break;
    case 'recurring_time':
    case 'peak_time_window':
      mark = <path d="M5 3v10M11 3v10" />;
      break;
    case 'change':
      mark = <path d="M2 5h7M7 11h7" />;
      break;
    case 'revisit_within_5m':
      mark = <path d="M12.5 4.5A5 5 0 1 0 13 10M12.5 1.5v4h-4" />;
      break;
    case 'friction_response':
      mark = <><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" /></>;
      break;
    case 'longest_session':
      mark = <rect x="1.5" y="6" width="13" height="4" rx="2" />;
      break;
    default:
      throw new Error('ZEN_SITE_LEDGER_GLYPH_INVALID');
  }
  return <svg className="zen-site-ledger-glyph" data-kind={kind} viewBox="0 0 16 16"
    width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{mark}</svg>;
}
