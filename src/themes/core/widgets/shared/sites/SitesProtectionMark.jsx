import React from 'react';
import { SiteProtectionIcon } from '@/ui-kit/Icons.jsx';

function ZenBoundaryStoneMark({ size, className, ...ariaProps }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...ariaProps}
    >
      <path
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1"
        strokeLinejoin="round"
        d="M4.4 21.4C4.8 18.6 6.8 16.2 9.8 14.3C12.2 12.8 15.3 12.7 18 13.3C22.1 14.1 25.6 16.6 27.1 19.2C28.5 21.6 28.5 23.3 25.7 24.1C22.8 24.9 17.6 25.2 12.4 24.7C8.7 24.4 3.7 24 4.4 21.4Z"
      />
      <path
        fill="currentColor"
        opacity="0.1"
        d="M5.4 21.8C10.2 23.3 17.5 23.7 23.8 22.3C25.6 21.9 27 21.1 27.8 20.7C28.5 22.5 27.8 23.4 25.7 24.1C22.8 24.9 17.6 25.2 12.4 24.7C8.7 24.4 5.1 23.9 5.4 21.8Z"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 13.4C12.1 16.8 12.5 21.4 13.7 24.9M4.7 20.7C10.9 21.4 20 20.2 26.5 17.9M13.8 13.3L16.8 12.5"
      />
      <path
        fill="currentColor"
        d="M12.1 12.2L14.4 12.7L13.9 14.6L11.8 14.1Z"
      />
    </svg>
  );
}

// Both presentations are deliberate: Zen uses a tied garden boundary stone and the
// standard Sites presentation keeps its established protection symbol.
export default function SitesProtectionMark({
  world = 'standard',
  size = 24,
  className = '',
  ...ariaProps
}) {
  if (world === 'zen') {
    return <ZenBoundaryStoneMark size={size} className={className} {...ariaProps} />;
  }

  return <SiteProtectionIcon size={size} className={className} aria-hidden="true" focusable="false" {...ariaProps} />;
}
