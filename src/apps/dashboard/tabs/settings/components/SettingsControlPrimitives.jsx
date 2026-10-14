import React, { useEffect, useId, useRef } from 'react';
import {
  getDashboardStateTransitionStyle,
} from '@/themes/core/motion/index.js';

const CONTROL_BUTTON_STYLE = getDashboardStateTransitionStyle('dashboard.control.button');
const TOGGLE_TRACK_STYLE = getDashboardStateTransitionStyle('dashboard.control.toggle-track');
const TOGGLE_KNOB_STYLE = getDashboardStateTransitionStyle('dashboard.control.toggle-knob');

function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function SettingsLedger({ children, className = '', as: Component = 'div' }) {
  return (
    <Component
      className={joinClasses(
        'relative min-h-0 overflow-visible divide-y divide-border/25',
        className,
      )}
    >
      {children}
    </Component>
  );
}

const COLUMN_LAYOUTS = Object.freeze({
  two: 'lg:grid-cols-2 lg:divide-x lg:divide-y-0',
  safety: 'grid-cols-1',
  access: 'grid-cols-1',
  workspace: 'grid-cols-1',
});

export function SettingsLedgerColumns({
  children,
  className = '',
  layout = 'two',
}) {
  return (
    <div
      className={joinClasses(
        'grid min-h-0 divide-y divide-border/40',
        COLUMN_LAYOUTS[layout] || COLUMN_LAYOUTS.two,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SettingsGroup({
  eyebrow = '',
  title,
  description = '',
  meta = null,
  children,
  className = '',
  bodyClassName = '',
  headingAs: Heading = 'h2',
}) {
  return (
    <section className={joinClasses('grid min-w-0 gap-2 py-5 sm:grid-cols-[minmax(150px,0.36fr)_minmax(0,1fr)] sm:gap-8', className)}>
      <header className="flex min-w-0 items-start justify-between gap-4 px-1 py-2">
        <div className="min-w-0">
          {eyebrow ? (
              <div className="text-xs text-on-surface-muted">
              {eyebrow}
            </div>
          ) : null}
          <Heading className={joinClasses(
            'text-sm font-medium leading-6 text-on-surface',
            eyebrow && 'mt-1',
          )}>
            {title}
          </Heading>
          {description ? (
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-on-surface-muted">
              {description}
            </p>
          ) : null}
        </div>
        {meta ? <div className="shrink-0 pt-0.5">{meta}</div> : null}
      </header>
      <div className={joinClasses('min-h-0 min-w-0', bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  title,
  description = '',
  meta = '',
  children,
  tone = 'default',
  layout = 'responsive',
  className = '',
  contentClassName = '',
  as: Component = 'div',
}) {
  return (
    <Component
      className={joinClasses(
        'flex min-h-[56px] min-w-0 justify-center gap-3 px-1 py-3',
        layout === 'stacked'
          ? 'flex-col items-stretch'
          : layout === 'inline' ? 'flex-row items-center justify-between'
            : 'flex-col sm:flex-row sm:items-center sm:justify-between',
        tone === 'danger' && 'bg-danger/[0.018]',
        className,
      )}
    >
      <div className={joinClasses(
        'min-w-0',
        layout !== 'stacked' && 'sm:pr-5',
      )}>
        <div className={joinClasses(
          'text-sm font-medium leading-5 text-on-surface',
          tone === 'danger' && 'text-danger',
        )}>
          {title}
        </div>
        {description ? (
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-muted">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="mt-1 text-xs leading-relaxed text-on-surface-muted">{meta}</div>
        ) : null}
      </div>
      {children ? (
        <div className={joinClasses(
          'min-w-0 shrink-0',
          layout === 'stacked' && 'w-full',
          contentClassName,
        )}>
          {children}
        </div>
      ) : null}
    </Component>
  );
}

export function SettingsDisclosure({ title, summary = '', children, defaultOpen = false, open: controlledOpen, revealRequest = null, summaryRef = null, onOpenChange = null }) {
  const [localOpen, setOpen] = React.useState(defaultOpen);
  const open = controlledOpen === undefined ? localOpen : controlledOpen;
  const localSummaryRef = useRef(null);
  const focusRef = summaryRef || localSummaryRef;
  useEffect(() => {
    if (!revealRequest) return;
    setOpen(true);
    focusRef.current?.focus({ preventScroll: true });
    focusRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [focusRef, revealRequest]);
  return (
    <details
      open={open}
      onToggle={(event) => {
        if (event.target !== event.currentTarget) return;
        if (controlledOpen === undefined) setOpen(event.currentTarget.open);
        onOpenChange?.(event.currentTarget.open);
      }}
      className="group/settings-disclosure min-w-0"
    >
      <summary ref={focusRef} className="flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4 text-sm text-on-surface [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent/50">
        <span className="font-medium">{title}</span>
        <span className="flex min-w-0 items-center gap-3 text-xs text-on-surface-muted">
          {summary}
          <span aria-hidden="true">{open ? '−' : '+'}</span>
        </span>
      </summary>
      {open ? <div className="min-w-0 pb-4">{children}</div> : null}
    </details>
  );
}

export function SettingsStatus({ children, tone = 'neutral' }) {
  return (
    <span className={joinClasses(
      'inline-flex items-center gap-2 whitespace-nowrap text-[11px] font-medium',
      tone === 'warning' && 'text-on-surface',
      tone === 'danger' && 'text-danger',
      tone === 'neutral' && 'text-on-surface-muted',
    )}>
      <span className={joinClasses(
        'h-3 w-0.5 shrink-0',
        tone === 'warning' && 'bg-warning/80',
        tone === 'danger' && 'bg-danger/80',
        tone === 'neutral' && 'bg-on-surface/45',
      )} />
      {children}
    </span>
  );
}

export function SettingsChoiceGroup({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
  className = '',
}) {
  const generatedName = useId();
  if (!disabled && typeof onValueChange !== 'function') {
    throw new Error('SETTINGS_CHOICE_GROUP_HANDLER_REQUIRED');
  }

  return (
    <fieldset disabled={disabled} className={joinClasses('min-w-0', className)}>
      <legend className="sr-only">{label}</legend>
      <div className="divide-y divide-border/25">
        {options.map((option) => {
          const active = option.id === value;
          return (
            <label
              key={option.id}
              className={joinClasses(
                'relative block min-w-0',
                disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
              )}
            >
              <input
                type="radio"
                name={generatedName}
                value={option.id}
                checked={active}
                onChange={() => onValueChange?.(option.id)}
                className="peer sr-only"
              />
              <span className={joinClasses(
                'relative flex min-h-[62px] min-w-0 items-center gap-3 px-5 py-3 text-left outline-hidden transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-accent/30 lg:px-6',
                active
                  ? 'bg-background/38 text-on-surface'
                  : 'text-on-surface-muted hover:bg-background/22 hover:text-on-surface',
              )}>
                <span
                  aria-hidden="true"
                  className={joinClasses(
                    'absolute inset-y-2 left-0 w-0.5 transition-colors',
                    active
                      ? option.tone === 'warning' ? 'bg-warning/80' : 'bg-on-surface/65'
                      : 'bg-transparent',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-baseline justify-between gap-3">
                    <span className="text-sm font-medium leading-5 text-on-surface">
                      {option.label}
                    </span>
                    {option.eyebrow ? (
                      <span className={joinClasses(
                        'shrink-0 text-[9px] font-medium tracking-[0.09em] text-on-surface-muted/65',
                        option.tone === 'warning' && active && 'text-on-surface',
                      )}>
                        {option.eyebrow}
                      </span>
                    ) : null}
                  </span>
                  {option.description ? (
                    <span className="mt-1 block text-xs leading-relaxed text-on-surface-muted">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SettingsInlineChoice({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
  className = '',
}) {
  const generatedName = useId();
  if (!disabled && typeof onValueChange !== 'function') {
    throw new Error('SETTINGS_INLINE_CHOICE_HANDLER_REQUIRED');
  }
  return (
    <fieldset disabled={disabled} className={joinClasses('min-w-0', className)}>
      <legend className="sr-only">{label}</legend>
      <div className="inline-flex items-stretch border-b border-border/35">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <label
              key={option.id}
              className={joinClasses(
                'relative block',
                disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
              )}
              style={CONTROL_BUTTON_STYLE}
            >
              <input
                type="radio"
                name={generatedName}
                value={option.id}
                checked={active}
                onChange={() => onValueChange?.(option.id)}
                className="peer sr-only"
              />
              <span className={joinClasses(
                'relative block min-w-[76px] px-3 py-2 text-center text-xs font-medium outline-hidden transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-accent/30',
                active ? 'text-on-surface' : 'text-on-surface-muted hover:text-on-surface',
              )}>
                {option.label}
                <span
                  aria-hidden="true"
                  className={joinClasses(
                    'absolute inset-x-2 -bottom-px h-0.5',
                    active ? 'bg-on-surface/65' : 'bg-transparent',
                  )}
                />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SettingsSwitch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  errorCode = 'SETTINGS_SWITCH_HANDLER_REQUIRED',
}) {
  if (!disabled && typeof onCheckedChange !== 'function') {
    throw new Error(errorCode);
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={joinClasses(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border outline-hidden focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'border-on-surface/70 bg-on-surface/80' : 'border-border/60 bg-on-surface/10',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
      )}
      style={TOGGLE_TRACK_STYLE}
    >
      <span
        aria-hidden="true"
        className={joinClasses(
          'pointer-events-none h-4 w-4 rounded-full transition-transform',
          checked
            ? 'translate-x-[19px] bg-surface'
            : 'translate-x-[3px] bg-on-surface/55',
        )}
        style={TOGGLE_KNOB_STYLE}
      />
    </button>
  );
}

const ACTION_TONES = Object.freeze({
  primary: 'border-on-surface/80 bg-on-surface text-surface hover:opacity-90',
  neutral: 'border-border/35 bg-transparent text-on-surface-muted hover:border-border/55 hover:bg-background/35 hover:text-on-surface',
  warning: 'border-warning/35 bg-transparent text-on-surface hover:bg-warning/[0.05]',
  danger: 'border-danger/30 bg-transparent text-danger hover:bg-danger/[0.045]',
});

export function SettingsActionButton({
  children,
  onClick,
  disabled = false,
  tone = 'neutral',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={joinClasses(
        'min-h-9 shrink-0 rounded border px-3 py-2 text-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40',
        ACTION_TONES[tone] || ACTION_TONES.neutral,
        className,
      )}
      style={CONTROL_BUTTON_STYLE}
      {...props}
    >
      {children}
    </button>
  );
}

export function SettingsTextInput({ className = '', ...props }) {
  return (
    <input
      className={joinClasses(
        'min-h-9 w-full border-0 border-b border-border/40 bg-transparent px-0 py-2 font-mono text-sm text-on-surface outline-hidden placeholder:text-on-surface-muted/35 focus-visible:border-on-surface/65 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      {...props}
    />
  );
}

export function SettingsSelect({ className = '', ...props }) {
  return (
    <select
      className={joinClasses(
        'min-h-10 w-full min-w-0 rounded border border-border/35 bg-background px-3 py-2 text-sm text-on-surface outline-hidden focus-visible:border-on-surface/65 focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      {...props}
    />
  );
}

export function SettingsFeedback({
  message,
  tone = 'neutral',
  className = '',
}) {
  if (!message) return null;
  const isError = tone === 'danger';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={joinClasses(
        'border-t px-5 py-3 text-[11px] leading-relaxed lg:px-6',
        tone === 'danger' && 'border-danger/25 bg-danger/[0.025] text-danger',
        tone === 'warning' && 'border-warning/30 bg-warning/[0.025] text-on-surface',
        tone === 'neutral' && 'border-border/15 text-on-surface-muted',
        className,
      )}
    >
      {message}
    </div>
  );
}

export function SettingsInlineTask({
  title,
  description = '',
  children,
  actions = null,
  onClose,
  tone = 'neutral',
  className = '',
  busy = false,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const taskRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  if (typeof onClose !== 'function') {
    throw new Error('SETTINGS_INLINE_TASK_CLOSE_HANDLER_REQUIRED');
  }

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    previouslyFocusedRef.current = document.activeElement;
    const task = taskRef.current;
    (task?.querySelector('[data-settings-task-autofocus="true"]') || task)?.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      const origin = previouslyFocusedRef.current;
      if (active !== document.body && !task?.contains(active)) return;
      if (!origin?.isConnected || origin.matches(':disabled')
        || origin.closest('[hidden], [inert], [aria-hidden="true"]')) return;
      for (let node = origin; node; node = node.parentElement) {
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return;
        if (node.tagName === 'DETAILS' && !node.open) {
          const summary = node.querySelector(':scope > summary');
          if (!summary?.contains(origin)) return;
        }
      }
      origin.focus({ preventScroll: true });
    };
  }, []);

  return (
      <section
        ref={taskRef}
        role="region"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={busy}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || busy) return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
        className={joinClasses(
          'my-3 w-full max-w-[560px] border-l-2 py-1 pl-4 outline-hidden sm:pl-5',
          tone === 'danger' ? 'border-danger/45' : 'border-on-surface/25',
          className,
        )}
      >
        <header className="py-2">
          <h2
            id={titleId}
            className={joinClasses(
              'text-sm font-semibold text-on-surface',
              tone === 'danger' && 'text-danger',
            )}
          >
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-on-surface-muted">
              {description}
            </p>
          ) : null}
        </header>
        {children ? <div className="min-w-0 py-2">{children}</div> : null}
        {actions ? (
          <footer className="flex flex-wrap gap-2 py-3">
            {actions}
          </footer>
        ) : null}
      </section>
  );
}
