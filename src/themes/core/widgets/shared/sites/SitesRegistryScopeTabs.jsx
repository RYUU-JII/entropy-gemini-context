import React from 'react';

function joinClassNames(...values) {
  return values.filter(Boolean).join(' ');
}

const DEFAULT_CLASS_NAMES = Object.freeze({
  container: 'flex',
  track: 'flex w-full gap-1 p-1',
  button: 'group relative isolate flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[14px] px-4 py-2 transition-[color,background-color,box-shadow,transform,translate,scale,rotate] duration-200 ease-out focus-visible:outline-hidden',
  buttonActive: '',
  buttonIdle: '',
  surface: 'pointer-events-none absolute inset-[1px] opacity-0 transition-opacity duration-200 ease-out',
  surfaceActive: 'opacity-100',
  surfaceIdle: 'opacity-0',
  content: 'relative z-10 flex min-w-0 flex-1 items-center justify-between gap-3',
  contentSingle: 'relative z-10 flex min-w-0 flex-1 items-center justify-center gap-3',
  label: 'truncate',
  labelActive: '',
  labelIdle: '',
  count: 'shrink-0 tabular-nums',
  countActive: '',
  countIdle: '',
});

export default function SitesRegistryScopeTabs({
  tabs = [],
  activeTab = '',
  onChange,
  classNames = {},
}) {
  const resolvedClassNames = { ...DEFAULT_CLASS_NAMES, ...classNames };

  return (
    <div className={resolvedClassNames.container}>
      <div className={resolvedClassNames.track}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const hasCount = tab.count !== null && tab.count !== undefined;

          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange?.(tab.id)}
              className={joinClassNames(
                resolvedClassNames.button,
                'focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2',
                isActive ? resolvedClassNames.buttonActive : resolvedClassNames.buttonIdle
              )}
            >
              <span
                aria-hidden="true"
                style={{ borderRadius: 'inherit' }}
                className={joinClassNames(
                  resolvedClassNames.surface,
                  isActive ? resolvedClassNames.surfaceActive : resolvedClassNames.surfaceIdle
                )}
              />

              <span className={hasCount ? resolvedClassNames.content : resolvedClassNames.contentSingle}>
                <span
                  className={joinClassNames(
                    resolvedClassNames.label,
                    isActive ? resolvedClassNames.labelActive : resolvedClassNames.labelIdle
                  )}
                >
                  {tab.label}
                </span>

                {hasCount ? (
                  <span
                    className={joinClassNames(
                      resolvedClassNames.count,
                      isActive ? resolvedClassNames.countActive : resolvedClassNames.countIdle
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
