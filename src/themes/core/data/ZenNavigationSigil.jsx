import React from 'react';

const SHARED_SVG_PROPS = Object.freeze({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.55,
});

/**
 * Zen navigation sigils.
 *
 * Drawing contract (the set is read at 20px in the sidebar, 16px in dense chrome):
 * - Two ink levels only: 1.0 for the shape, 0.5-0.7 for supporting strokes.
 *   Anything fainter disappears at 20px on the Zen paper ground.
 * - 2-4 strokes per sigil, no ground line, no fill except a single focal accent.
 * - Verify at 16px, not at display size.
 */
const ZEN_NAVIGATION_SIGILS = Object.freeze({
  // Suiren: a water lily seen from the side. Five spoon-shaped petals in three
  // depth layers - two outer petals dipping just under the base line, two mid petals,
  // one upright center petal - drawn back to front. Each layer is masked by the
  // layers in front of it so the petals overlap in silhouette without their
  // outlines ever crossing; without the masks the strokes cut through each other
  // and the flower reads as a tangle at 20px.
  // Petal profile follows the pond renderer's own Nymphaea petal - a narrow
  // attachment with a generous middle - and stops at five so it never becomes
  // the mechanical pinwheel that renderer warns against.
  // See src/themes/plugins/zen/pond/world/decor/decorLilyPadWaterLily.js.
  main: function WaterLilySigil(props) {
    // useId keeps the mask ids unique per instance; its colons are stripped
    // because a url(#...) reference containing them is not portable.
    const seed = React.useId().replace(/:/g, '');
    const behindMidId = `zen-suiren-behind-mid-${seed}`;
    const behindCenterId = `zen-suiren-behind-center-${seed}`;
    const OUTER_LEFT = 'M12 15.78C9.53 13.17 5.32 14.23 4.08 16.89C6 19.11 10.35 18.96 12 15.78Z';
    const OUTER_RIGHT = 'M12 15.78C13.65 18.96 18 19.11 19.92 16.89C18.68 14.23 14.47 13.17 12 15.78Z';
    const MID_LEFT = 'M12 15.78C12.16 12.09 8.28 9.44 5.37 10.22C5.11 13.22 8.4 16.57 12 15.78Z';
    const MID_RIGHT = 'M12 15.78C15.6 16.57 18.89 13.22 18.63 10.22C15.72 9.44 11.84 12.09 12 15.78Z';
    const CENTER = 'M12 15.78C15.14 13.13 14.65 7.65 12 5.61C9.35 7.65 8.86 13.13 12 15.78Z';
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <mask id={behindMidId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <path d={CENTER} fill="black" stroke="black" />
          <path d={MID_LEFT} fill="black" stroke="black" />
          <path d={MID_RIGHT} fill="black" stroke="black" />
        </mask>
        <mask id={behindCenterId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <path d={CENTER} fill="black" stroke="black" />
        </mask>
        <g mask={`url(#${behindMidId})`} opacity="0.6">
          <path d={OUTER_LEFT} />
          <path d={OUTER_RIGHT} />
        </g>
        <g mask={`url(#${behindCenterId})`} opacity="0.82">
          <path d={MID_LEFT} />
          <path d={MID_RIGHT} />
        </g>
        <path d={CENTER} />
      </svg>
    );
  },
  experiment: function MeasuredStoneSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <path d="M6.8 17.4c.6-4.4 2.4-7.4 5.2-7.4s4.6 3 5.2 7.4c-3 .8-7.4.8-10.4 0Z" />
        <path d="M6.4 6.2h11.2" opacity="0.45" />
        <path d="M9.2 5.2v2M14.8 5.2v2" opacity="0.45" />
      </svg>
    );
  },
  // Torii: a declared boundary with no decision left to make, which is what a
  // per-site rule is. Matches the Torii/Shimenawa role defined in AGENTS.md.
  sites: function ToriiSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <path d="M4.2 7.2h15.6" />
        <path d="M6.2 10.3h11.6" opacity="0.68" />
        <path d="M7.6 7.4V19M16.4 7.4V19" />
      </svg>
    );
  },
  // Sun over the horizon: the hour of the day the relaxation windows are cut from.
  schedule: function DayHorizonSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <path d="M4 17.4h16" />
        <path d="M7.4 17.4a4.6 4.6 0 0 1 9.2 0" />
        <path d="M12 6.6v2.2M6.1 9.1l1.5 1.5M17.9 9.1l-1.5 1.5" opacity="0.5" />
      </svg>
    );
  },
  // Wagasa: protection that covers from above without being asked.
  filter: function WagasaSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <path d="M3.6 12.4a8.4 8.4 0 0 1 16.8 0Z" />
        <path d="M12 12.4v5.4a2 2 0 0 0 2.6 1.8" opacity="0.8" />
      </svg>
    );
  },
  // Enso: the artifact room's emblem. The Enso is the culminating artifact and
  // the app's own mark, so it is deliberately not spent on the everyday entry
  // tab; it stays where the artifacts live and is expected to recur across the
  // toolbar icon, the boot loader and every theme's own Enso.
  // The opening sits at 7 o'clock and reuses the boot Enso's gesture (46.8
  // degree gap, 1.06 horizontal ovality) so the two read as one hand.
  // See src/themes/plugins/zen/presentation/ZenSoftBootShell.js.
  tools: function EnsoSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <path d="M6.26 16.03A7.15 6.75 0 1 1 11.18 18.71" />
      </svg>
    );
  },
  settings: function GardenRakeSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <path d="M5 5 12.2 12.3" />
        <path d="M9.6 13.6h9.4" />
        <path d="M11.6 13.8v4M14.3 13.8v4M17 13.8v4" />
      </svg>
    );
  },
  theme: function HangingScrollSigil(props) {
    return (
      <svg {...SHARED_SVG_PROPS} {...props}>
        <path d="M5 4.8h14M6.6 19.2h10.8" />
        <path d="M7.4 6.2v12.2M16.6 6.2v12.2" opacity="0.42" />
        <path d="M13.4 8.8c-2.2 1.7-2.9 4-1.8 6.6" />
      </svg>
    );
  },
});

export default function ZenNavigationSigil({ tabId, ...props }) {
  const Sigil = ZEN_NAVIGATION_SIGILS[tabId];
  if (!Sigil) {
    throw new Error(
      `[ZenNavigationSigil] Unknown dashboard tab id "${tabId || '<empty>'}".`,
    );
  }

  return (
    <Sigil
      aria-hidden="true"
      data-zen-navigation-sigil={tabId}
      focusable="false"
      {...props}
    />
  );
}
