import React from 'react';
import { Power } from 'lucide-react';

function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ');
}

const VARIANT_STYLES = Object.freeze({
  default: Object.freeze({
    off: 'border border-border/18 bg-surface/28 text-on-surface-muted/78 hover:border-border/30 hover:bg-surface/52 hover:text-on-surface',
    on: 'border border-transparent bg-transparent text-on-surface-muted/38 hover:border-border/18 hover:bg-surface/36 hover:text-on-surface-muted/82',
    warning: 'border border-warning/22 bg-warning/8 text-warning/82 hover:border-warning/34 hover:bg-warning/12',
  }),
  zen: Object.freeze({
    off: 'border border-stone-400/25 bg-stone-900/5 text-stone-600/78 hover:bg-stone-900/10 hover:text-stone-900',
    on: 'border border-transparent bg-transparent text-stone-500/46 hover:bg-black/10 hover:text-stone-800',
    warning: 'border border-amber-700/16 bg-amber-700/10 text-amber-800/82 hover:bg-amber-700/16',
  }),
  cyberpunk: Object.freeze({
    off: 'border border-[#1c466a] bg-[#03111f]/90 text-[#8bb6d4] hover:border-[#3479a9] hover:bg-[#051a2d] hover:text-[#def3ff]',
    on: 'border border-transparent bg-transparent text-[#5f8197] hover:border-[#214d71] hover:bg-[#041629]/72 hover:text-[#a9d8f2]',
    warning: 'border border-amber-300/22 bg-amber-300/10 text-amber-200 hover:bg-amber-300/14',
  }),
  entropy: Object.freeze({
    off: 'rounded-[3px] border border-[#82918b] bg-[#aab7ae] text-[#25312c] shadow-[inset_0_1px_0_#ffffff80,0_2px_0_#64746a] hover:bg-[#d2dcd0]',
    on: 'rounded-[3px] border border-[#dfe8d7] bg-[#d6e7cb] text-[#24332a] shadow-[inset_0_1px_0_#fff,0_0_10px_#c5e0ab70] hover:bg-[#e6f1dc]',
    warning: 'rounded-[3px] border border-[#b48438] bg-[#eed296] text-[#523700] hover:bg-[#f7dfb2]',
  }),
});

function buildButtonTitle(model) {
  const parts = [
    model.label,
    model.toggleStateLabel || model.stateLabel || '',
  ];

  if (model.stateLabel && model.stateLabel !== model.toggleStateLabel) {
    parts.push(model.stateLabel);
  }
  if (model.runtimeLabel) {
    parts.push(model.runtimeLabel);
  }

  return parts.filter(Boolean).join(' · ');
}

export default function ArtifactMasterToggleBar({
  model = null,
  variant = 'default',
  className = '',
}) {
  if (!model) {
    return null;
  }

  const palette = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
  const canAct = typeof model.onAction === 'function';
  const isDisabled = model.disabled === true || !canAct;
  const toneClass = model.stateTone === 'warning'
    ? palette.warning
    : (model.enabled === true ? palette.on : palette.off);
  const title = buildButtonTitle(model);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        if (canAct) model.onAction();
      }}
      disabled={isDisabled}
      aria-pressed={model.enabled === true}
      aria-label={title || model.label}
      title={title || model.label}
      className={joinClasses(
        'group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-[background-color,border-color,color,opacity,box-shadow] duration-200 ease-out',
        'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
        toneClass,
        isDisabled
          ? 'cursor-not-allowed opacity-35'
          : (model.enabled === true && model.stateTone !== 'warning'
            ? 'cursor-pointer opacity-72 hover:opacity-100'
            : 'cursor-pointer hover:opacity-95'),
        className,
      )}
    >
      <Power className="h-4 w-4" strokeWidth={2.2} />
      {model.stateTone === 'warning' ? (
        <span className="absolute right-[6px] top-[6px] h-1.5 w-1.5 rounded-full bg-current opacity-85" />
      ) : null}
    </button>
  );
}
