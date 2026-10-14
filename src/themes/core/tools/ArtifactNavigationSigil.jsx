import React from 'react';

const SHARED_SVG_PROPS = Object.freeze({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.8,
});

const ARTIFACT_NAVIGATION_SIGILS = Object.freeze({
  lens: function LensSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <rect x="5.5" y="4.5" width="13" height="15" rx="1.4" />
        <path d="M12 7v10" opacity="0.64" />
      </svg>
    );
  },
  veil: function VeilSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <path d="M18.2 7.2A7.5 7.5 0 1 0 18.2 16.8" />
        <path d="M16.7 9.2c1.2 1.8 1.2 3.8 0 5.6" opacity="0.58" />
      </svg>
    );
  },
  barrier: function BarrierSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <rect x="5.5" y="5" width="13" height="14" rx="1" />
        <path d="M9.5 19v-7h5v7" opacity="0.68" />
      </svg>
    );
  },
  gate: function GateSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <path d="M5 16.5 19 8.5" strokeWidth="2.2" />
        <circle cx="7" cy="15.3" r="2.1" opacity="0.68" />
      </svg>
    );
  },
  brake: function BrakeSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <path d="M4.5 17c.7-5 3.5-7.7 7.5-7.7s6.8 2.7 7.5 7.7c-4.2 1.5-10.8 1.5-15 0Z" />
        <path d="M8.2 12.2c2.2 1.2 5.4 1.2 7.6 0" opacity="0.58" />
      </svg>
    );
  },
  flare: function FlareSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <path d="M7 7h10c0 5.7-1.7 8.5-5 8.5S7 12.7 7 7Z" />
        <path d="M12 3.5V7m0 8.5v5" opacity="0.68" />
      </svg>
    );
  },
  echo: function EchoSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <path d="M3.5 10.2c2.1-2.7 4.4-2.7 6.5 0s4.4 2.7 6.5 0 3.3-2.4 4-1.5" />
        <path d="M3.5 15.8c2.1-2.7 4.4-2.7 6.5 0s4.4 2.7 6.5 0 3.3-2.4 4-1.5" opacity="0.52" />
      </svg>
    );
  },
});

export default function ArtifactNavigationSigil({ artifactId, ...props }) {
  const Sigil = ARTIFACT_NAVIGATION_SIGILS[artifactId];
  if (!Sigil) {
    throw new Error(
      `[ArtifactNavigationSigil] Unknown canonical artifact id "${artifactId || '<empty>'}".`,
    );
  }
  return <Sigil aria-hidden="true" focusable="false" {...props} />;
}
