import React from 'react';

export default function LandingSoundControl({ enabled, copy, onToggle }) {
  return (
    <button
      className="landing-sound-control"
      type="button"
      aria-pressed={enabled}
      aria-label={enabled ? copy.disable : copy.enable}
      onClick={onToggle}
    >
      <span className="landing-sound-control__glyph" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="landing-sound-control__label">{enabled ? copy.disable : copy.enable}</span>
    </button>
  );
}
