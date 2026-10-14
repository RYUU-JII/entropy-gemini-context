import React from 'react';

import {
  THEME_BOOT_SCREEN_CSS,
  getThemeBootPresentation,
  getThemeBootStyleVars,
} from './presentationCatalog.js';

function BootDots() {
  return (
    <span className="theme-boot-screen__dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export default function ThemeBootScreen({
  themeId = '',
  presentation = null,
}) {
  const profile = presentation || getThemeBootPresentation(themeId);
  const style = getThemeBootStyleVars(profile);

  return (
    <div
      className={`theme-boot-screen theme-boot-screen--${profile.motif}`}
      data-theme-id={profile.themeId}
      style={style}
    >
      <style>{THEME_BOOT_SCREEN_CSS}</style>
      <div className="theme-boot-screen__backdrop" />
      <div className="theme-boot-screen__grain" />
      <div className="theme-boot-screen__scan" />
      <div className="theme-boot-screen__stage">
        <div className="theme-boot-screen__eyebrow">{profile.eyebrow}</div>
        <div className="theme-boot-screen__core" aria-hidden="true">
          <div className="theme-boot-screen__track theme-boot-screen__track--a" />
          <div className="theme-boot-screen__track theme-boot-screen__track--b" />
          <div className="theme-boot-screen__track theme-boot-screen__track--c" />
          <div className="theme-boot-screen__glyph">{profile.glyph}</div>
        </div>
        <div className="theme-boot-screen__title">{profile.title}</div>
        <div className="theme-boot-screen__subtitle">{profile.subtitle}</div>
        <div className="theme-boot-screen__status">
          <span>{profile.status}</span>
          <BootDots />
        </div>
      </div>
    </div>
  );
}
