import React from 'react';

const PATHS = Object.freeze({
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
  shortform: <><path d="m8 3 11 6-5 3 5 3-11 6-3-5 5-4-5-4Z" /></>,
  play: <path d="m8 4 12 8-12 8Z" />,
  support: <><path d="M4 9h13v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Zm13 1h2a3 3 0 0 1 0 6h-2M7 3v2m4-2v2m4-2v2" /></>,
  heart: <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />,
  comment: <path d="M21 11.5A9.5 9.5 0 0 1 7 20l-5 2 2-5A9.5 9.5 0 1 1 21 11.5Z" />,
  share: <><path d="M12 15V2m-5 5 5-5 5 5"/><path d="M5 11H3v10h18V11h-2"/></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
  external: <><path d="M14 3h7v7m0-7L10 14"/><path d="M10 3H3v18h18v-7"/></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,
  spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  check: <path d="m4 12 5 5L20 6" />,
  github: <><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-4c0-1-.2-1.7-.7-2.2 3.3-.4 6.7-1.6 6.7-7.3a5.7 5.7 0 0 0-1.5-4c.2-1-.1-2.1-.6-3 0 0-1.2-.4-4 1.5a14 14 0 0 0-7.8 0C5.3 1.1 4.1 1.5 4.1 1.5c-.5.9-.8 2-.6 3A5.7 5.7 0 0 0 2 8.5c0 5.7 3.4 6.9 6.7 7.3C8.2 16.3 8 17 8 18v4"/></>,
});

export default function Icon({ name, size = 20, ...props }) {
  if (!Object.hasOwn(PATHS, name)) throw new Error(`FEED_ICON_UNKNOWN:${name}`);
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{PATHS[name]}</svg>;
}

export function EntropyMark({ size = 32 }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="1.8"/><path d="m11 29 18-18M20 5v30" stroke="currentColor" strokeWidth="1.8"/></svg>;
}
