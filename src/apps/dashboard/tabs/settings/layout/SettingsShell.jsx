import React, { useLayoutEffect, useRef } from 'react';
import {
  getDashboardStateTransitionStyle,
  getInteractionMotionStyle,
} from '@/themes/core/motion/index.js';

const SETTINGS_STABLE_INTERACTION_STYLE = getInteractionMotionStyle('stable');
const SETTINGS_SECTION_TAB_STYLE = getDashboardStateTransitionStyle('dashboard.control.button');

function SettingsSectionTabs({
  sections,
  activeSectionId,
  onSectionChange,
  onSectionIntent,
  ariaLabel,
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="flex min-w-0 items-end gap-6 overflow-x-auto sm:gap-8"
    >
      {sections.map((section) => {
        const active = activeSectionId === section.id;
        return (
          <button
            key={section.id}
            type="button"
            data-settings-section-id={section.id}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSectionChange(section.id)}
            onPointerEnter={() => onSectionIntent?.(section.id)}
            onPointerDown={() => onSectionIntent?.(section.id)}
            onFocus={() => onSectionIntent?.(section.id)}
            className={`relative shrink-0 bg-transparent px-0 pb-3 pt-2 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-4 focus-visible:ring-offset-background ${active
              ? 'text-on-surface'
              : 'text-on-surface-muted hover:text-on-surface'
            }`}
            style={SETTINGS_SECTION_TAB_STYLE}
          >
            <span className="flex items-center gap-2">
              <span className="whitespace-nowrap text-sm font-medium leading-none tracking-[-0.01em]">
                {section.label}
              </span>
              <span
                aria-hidden={section.badge ? undefined : true}
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${section.badge
                  ? active ? 'bg-warning' : 'bg-warning/55'
                  : 'bg-transparent'}`}
              >
                {section.badge ? <span className="sr-only">{section.badge}</span> : null}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 bottom-0 h-0.5 ${active ? 'bg-on-surface' : 'bg-transparent'}`}
            />
          </button>
        );
      })}
    </nav>
  );
}

export default function SettingsShell({
  eyebrowLabel = 'Settings',
  sections,
  activeSectionId,
  onSectionChange,
  onSectionIntent = null,
  headerAction = null,
  children,
}) {
  const contentRef = useRef(null);
  // A section starts at its own heading. Updates inside that section retain
  // the reader's position, including asynchronous feedback and module loading.
  useLayoutEffect(() => {
    contentRef.current.scrollTop = 0;
  }, [activeSectionId]);
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-on-surface"
      style={SETTINGS_STABLE_INTERACTION_STYLE}
    >
      <header className="shrink-0 border-b border-border/20">
        <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-2 px-5 pt-5 sm:px-8 lg:pt-7">
          <div className="flex min-w-0 items-center justify-between gap-4 pb-3 md:shrink-0">
            <h1 className="font-heading text-xl font-medium tracking-tight text-on-surface">
              {eyebrowLabel}
            </h1>
            {headerAction ? <div className="shrink-0 md:hidden">{headerAction}</div> : null}
          </div>

          <div className="flex min-w-0 items-end gap-8">
            <SettingsSectionTabs
              sections={sections}
              activeSectionId={activeSectionId}
              onSectionChange={onSectionChange}
              onSectionIntent={onSectionIntent}
              ariaLabel={eyebrowLabel}
            />
            {headerAction ? <div className="hidden shrink-0 pb-3 md:block">{headerAction}</div> : null}
          </div>
        </div>
      </header>

      <main
        ref={contentRef}
        id="settings-content-area"
        className="min-h-0 flex-1 overscroll-contain overflow-y-auto"
        style={{ scrollbarGutter: 'stable both-edges' }}
      >
        <div className="mx-auto min-h-full w-full max-w-[1040px] px-5 py-4 sm:px-8 lg:py-5">
          {children}
        </div>
      </main>
    </div>
  );
}
