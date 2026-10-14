import React from 'react';

import Favicon from '@/ui-kit/Favicon.jsx';

const SHARP_VARIANTS = new Set(['entropy', 'cyberpunk', 'matrix', 'scp']);

const BASE_VARIANT = Object.freeze({
  radius: 24,
  shellStyle: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(248,250,252,0.94))',
    borderColor: 'rgba(148,163,184,0.22)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.46)',
  },
  iconStyle: {
    background: 'rgba(255,255,255,0.74)',
    borderColor: 'rgba(148,163,184,0.22)',
  },
  domainColor: '#0f172a',
  verdictColor: '#0f172a',
  supportingColor: 'rgba(51,65,85,0.62)',
  chipStyle: {
    background: 'rgba(255,255,255,0.66)',
    borderColor: 'rgba(148,163,184,0.18)',
  },
  chipColor: '#0f172a',
  buttonStyle: {
    background: '#ffffff',
    borderColor: 'rgba(15,23,42,0.14)',
    color: '#0f172a',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
  },
  toneStyles: Object.freeze({
    muted: {
      background: 'rgba(241,245,249,0.92)',
      borderColor: 'rgba(148,163,184,0.22)',
      color: '#475569',
    },
    ok: {
      background: 'rgba(236,253,245,0.92)',
      borderColor: 'rgba(16,185,129,0.22)',
      color: '#047857',
    },
    active: {
      background: 'rgba(239,246,255,0.92)',
      borderColor: 'rgba(59,130,246,0.22)',
      color: '#1d4ed8',
    },
    warn: {
      background: 'rgba(255,251,235,0.94)',
      borderColor: 'rgba(245,158,11,0.24)',
      color: '#b45309',
    },
    alert: {
      background: 'rgba(255,241,242,0.94)',
      borderColor: 'rgba(244,63,94,0.22)',
      color: '#be123c',
    },
  }),
});

const VARIANTS = Object.freeze({
  zen: {
    ...BASE_VARIANT,
    radius: 30,
    shellStyle: {
      background: 'linear-gradient(180deg, rgba(251,247,239,0.98), rgba(244,238,226,0.96))',
      borderColor: 'rgba(214,201,184,0.8)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.56), 0 10px 28px rgba(120,99,84,0.08)',
    },
    iconStyle: {
      background: 'rgba(255,250,243,0.8)',
      borderColor: 'rgba(214,201,184,0.62)',
    },
    domainColor: '#3d342c',
    verdictColor: '#4b3d33',
    supportingColor: 'rgba(84,67,56,0.72)',
    chipStyle: {
      background: 'rgba(255,251,245,0.68)',
      borderColor: 'rgba(214,201,184,0.62)',
    },
    chipColor: '#4b3d33',
    buttonStyle: {
      background: 'rgba(239,229,216,0.86)',
      borderColor: 'rgba(190,171,149,0.72)',
      color: '#4b3d33',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42)',
    },
    toneStyles: Object.freeze({
      muted: {
        background: 'rgba(255,250,243,0.9)',
        borderColor: 'rgba(214,201,184,0.62)',
        color: '#7d6557',
      },
      ok: {
        background: 'rgba(236,245,235,0.94)',
        borderColor: 'rgba(125,142,103,0.3)',
        color: '#507454',
      },
      active: {
        background: 'rgba(240,246,248,0.94)',
        borderColor: 'rgba(126,165,177,0.3)',
        color: '#5c7480',
      },
      warn: {
        background: 'rgba(250,242,228,0.96)',
        borderColor: 'rgba(204,168,111,0.32)',
        color: '#8b6c34',
      },
      alert: {
        background: 'rgba(252,240,237,0.96)',
        borderColor: 'rgba(173,105,88,0.3)',
        color: '#8e5c4d',
      },
    }),
  },
  entropy: {
    ...BASE_VARIANT,
    radius: 12,
    shellStyle: {
      background: 'linear-gradient(180deg, rgba(25,29,34,0.98), rgba(14,17,20,0.98))',
      borderColor: 'rgba(255,104,46,0.22)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 36px rgba(0,0,0,0.32)',
    },
    iconStyle: {
      background: 'rgba(255,255,255,0.05)',
      borderColor: 'rgba(255,255,255,0.12)',
    },
    domainColor: '#f8fafc',
    verdictColor: '#f8fafc',
    supportingColor: 'rgba(226,232,240,0.68)',
    chipStyle: {
      background: 'rgba(255,255,255,0.05)',
      borderColor: 'rgba(255,255,255,0.1)',
    },
    chipColor: '#f8fafc',
    buttonStyle: {
      background: 'linear-gradient(180deg, rgba(255,117,61,0.92), rgba(210,67,20,0.92))',
      borderColor: 'rgba(255,170,134,0.34)',
      color: '#fff9f6',
      boxShadow: '0 10px 24px rgba(255,104,46,0.18)',
    },
    toneStyles: Object.freeze({
      muted: {
        background: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.1)',
        color: 'rgba(226,232,240,0.72)',
      },
      ok: {
        background: 'rgba(20,83,45,0.28)',
        borderColor: 'rgba(52,211,153,0.24)',
        color: '#6ee7b7',
      },
      active: {
        background: 'rgba(28,68,88,0.34)',
        borderColor: 'rgba(96,165,250,0.24)',
        color: '#93c5fd',
      },
      warn: {
        background: 'rgba(120,53,15,0.36)',
        borderColor: 'rgba(251,191,36,0.24)',
        color: '#fbbf24',
      },
      alert: {
        background: 'rgba(127,29,29,0.42)',
        borderColor: 'rgba(248,113,113,0.24)',
        color: '#fda4af',
      },
    }),
  },
  cyberpunk: {
    ...BASE_VARIANT,
    radius: 10,
    shellStyle: {
      background: 'linear-gradient(180deg, rgba(5,9,20,0.98), rgba(9,14,28,0.98))',
      borderColor: 'rgba(0,243,255,0.22)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(106,92,255,0.12), 0 18px 38px rgba(0,0,0,0.34)',
    },
    iconStyle: {
      background: 'rgba(0,243,255,0.05)',
      borderColor: 'rgba(0,243,255,0.16)',
    },
    domainColor: '#f8fbff',
    verdictColor: '#f8fbff',
    supportingColor: 'rgba(207,233,255,0.68)',
    chipStyle: {
      background: 'rgba(7,16,31,0.82)',
      borderColor: 'rgba(0,243,255,0.16)',
    },
    chipColor: '#f8fbff',
    buttonStyle: {
      background: 'linear-gradient(90deg, rgba(0,243,255,0.86), rgba(106,92,255,0.88))',
      borderColor: 'rgba(255,255,255,0.16)',
      color: '#02131a',
      boxShadow: '0 0 24px rgba(0,243,255,0.16)',
    },
    toneStyles: Object.freeze({
      muted: {
        background: 'rgba(7,16,31,0.82)',
        borderColor: 'rgba(96,165,250,0.16)',
        color: 'rgba(191,219,254,0.78)',
      },
      ok: {
        background: 'rgba(6,78,59,0.52)',
        borderColor: 'rgba(52,211,153,0.22)',
        color: '#6ee7b7',
      },
      active: {
        background: 'rgba(8,47,73,0.66)',
        borderColor: 'rgba(0,243,255,0.2)',
        color: '#7dd3fc',
      },
      warn: {
        background: 'rgba(113,63,18,0.58)',
        borderColor: 'rgba(250,204,21,0.22)',
        color: '#fcd34d',
      },
      alert: {
        background: 'rgba(103,21,64,0.6)',
        borderColor: 'rgba(244,63,94,0.22)',
        color: '#fda4af',
      },
    }),
  },
  clinical: {
    ...BASE_VARIANT,
    radius: 24,
    shellStyle: {
      background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))',
      borderColor: 'rgba(148,163,184,0.22)',
      boxShadow: '0 16px 32px rgba(148,163,184,0.12)',
    },
    iconStyle: {
      background: 'rgba(248,250,252,0.92)',
      borderColor: 'rgba(148,163,184,0.2)',
    },
    domainColor: '#0f172a',
    verdictColor: '#0f172a',
    supportingColor: 'rgba(30,41,59,0.64)',
    chipStyle: {
      background: 'rgba(248,250,252,0.92)',
      borderColor: 'rgba(148,163,184,0.18)',
    },
    chipColor: '#0f172a',
    buttonStyle: {
      background: '#0f172a',
      borderColor: 'rgba(15,23,42,0.18)',
      color: '#ffffff',
      boxShadow: '0 10px 20px rgba(15,23,42,0.12)',
    },
  },
  matrix: {
    ...BASE_VARIANT,
    radius: 4,
    shellStyle: {
      background: 'linear-gradient(180deg, rgba(0,8,0,0.96), rgba(0,0,0,0.98))',
      borderColor: 'rgba(0,255,65,0.26)',
      boxShadow: 'inset 0 0 0 1px rgba(0,143,17,0.18), 0 18px 34px rgba(0,0,0,0.36)',
    },
    iconStyle: {
      background: 'rgba(0,12,0,0.76)',
      borderColor: 'rgba(0,143,17,0.24)',
    },
    domainColor: '#ccffcc',
    verdictColor: '#00ff41',
    supportingColor: 'rgba(143,255,175,0.68)',
    chipStyle: {
      background: 'rgba(0,10,0,0.88)',
      borderColor: 'rgba(0,143,17,0.22)',
    },
    chipColor: '#ccffcc',
    buttonStyle: {
      background: 'rgba(0,20,0,0.94)',
      borderColor: 'rgba(0,255,65,0.28)',
      color: '#00ff41',
      boxShadow: '0 0 18px rgba(0,255,65,0.12)',
    },
    toneStyles: Object.freeze({
      muted: {
        background: 'rgba(0,10,0,0.82)',
        borderColor: 'rgba(0,143,17,0.18)',
        color: 'rgba(143,255,175,0.68)',
      },
      ok: {
        background: 'rgba(0,26,8,0.82)',
        borderColor: 'rgba(34,197,94,0.24)',
        color: '#4ade80',
      },
      active: {
        background: 'rgba(0,31,24,0.82)',
        borderColor: 'rgba(0,255,65,0.2)',
        color: '#86efac',
      },
      warn: {
        background: 'rgba(61,42,0,0.8)',
        borderColor: 'rgba(255,204,0,0.24)',
        color: '#facc15',
      },
      alert: {
        background: 'rgba(60,0,0,0.84)',
        borderColor: 'rgba(255,51,51,0.22)',
        color: '#fca5a5',
      },
    }),
  },
  scp: {
    ...BASE_VARIANT,
    radius: 8,
    shellStyle: {
      background: 'linear-gradient(180deg, rgba(17,19,24,0.98), rgba(10,12,16,0.98))',
      borderColor: 'rgba(226,232,240,0.14)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 36px rgba(0,0,0,0.34)',
    },
    iconStyle: {
      background: 'rgba(255,255,255,0.05)',
      borderColor: 'rgba(226,232,240,0.12)',
    },
    domainColor: '#f8fafc',
    verdictColor: '#f8fafc',
    supportingColor: 'rgba(203,213,225,0.68)',
    chipStyle: {
      background: 'rgba(15,23,42,0.72)',
      borderColor: 'rgba(226,232,240,0.12)',
    },
    chipColor: '#f8fafc',
    buttonStyle: {
      background: 'rgba(148,25,25,0.92)',
      borderColor: 'rgba(248,113,113,0.2)',
      color: '#fff7f7',
      boxShadow: '0 12px 26px rgba(148,25,25,0.16)',
    },
    toneStyles: Object.freeze({
      muted: {
        background: 'rgba(15,23,42,0.72)',
        borderColor: 'rgba(226,232,240,0.12)',
        color: 'rgba(203,213,225,0.7)',
      },
      ok: {
        background: 'rgba(17,94,89,0.52)',
        borderColor: 'rgba(45,212,191,0.18)',
        color: '#5eead4',
      },
      active: {
        background: 'rgba(30,64,175,0.38)',
        borderColor: 'rgba(96,165,250,0.18)',
        color: '#93c5fd',
      },
      warn: {
        background: 'rgba(133,77,14,0.46)',
        borderColor: 'rgba(250,204,21,0.2)',
        color: '#fde68a',
      },
      alert: {
        background: 'rgba(127,29,29,0.52)',
        borderColor: 'rgba(248,113,113,0.2)',
        color: '#fecaca',
      },
    }),
  },
});

function getVariantStyles(variant) {
  return VARIANTS[variant] || VARIANTS.clinical;
}

function getToneStyle(styles, tone) {
  return styles.toneStyles?.[tone] || styles.toneStyles?.muted || BASE_VARIANT.toneStyles.muted;
}

function getBlockRadius(variant) {
  if (variant === 'matrix') return 4;
  if (SHARP_VARIANTS.has(variant)) return 12;
  return 999;
}

export default function SharedHomeBriefCard({
  brief = null,
  aiNarrationSlot = null,
  className = '',
  onAction = null,
  variant = 'clinical',
}) {
  const styles = getVariantStyles(variant);
  const tone = getToneStyle(styles, brief?.tone || 'muted');
  const chips = Array.isArray(brief?.chips) ? brief.chips.slice(0, 2) : [];
  const hasFooter = chips.length > 0 || Boolean(brief?.action);
  const blockRadius = getBlockRadius(variant);
  const iconRadius = SHARP_VARIANTS.has(variant) ? 12 : 18;

  return (
    <section
      className={`relative h-full min-h-0 overflow-hidden border p-4 md:p-5 ${className}`}
      style={{
        ...styles.shellStyle,
        borderRadius: styles.radius,
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: tone.borderColor || styles.shellStyle.borderColor }} />

      <div className={`relative z-10 flex h-full min-h-0 flex-col gap-4 ${hasFooter ? 'justify-between' : 'justify-center'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center border"
              style={{
                ...styles.iconStyle,
                borderRadius: iconRadius,
              }}
            >
              {brief?.focusDomain ? (
                <Favicon domain={brief.focusDomain} size={20} className="rounded-[6px]" />
              ) : (
                <div className="h-2 w-2 rounded-full" style={{ background: tone.color || styles.verdictColor }} />
              )}
            </div>

            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold tracking-tight md:text-[16px]" style={{ color: styles.domainColor }}>
                {brief?.focusDomain || brief?.statusLabel}
              </div>
            </div>
          </div>

          {brief?.statusLabel ? (
            <div
              className="inline-flex shrink-0 items-center border px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em]"
              style={{
                ...tone,
                borderRadius: blockRadius,
              }}
            >
              {brief.statusLabel}
            </div>
          ) : null}
        </div>

        <div className="min-h-0">
          <div className="max-w-[14ch] text-[28px] font-semibold leading-[1.02] tracking-tight md:text-[32px]" style={{ color: styles.verdictColor }}>
            {brief?.verdict}
          </div>
          {brief?.supportingText ? (
            <p className="mt-1.5 text-[12px] font-medium leading-5" style={{ color: styles.supportingColor }}>
              {brief.supportingText}
            </p>
          ) : null}
          {aiNarrationSlot ? (
            <div
              className="mt-2 border-t pt-2"
              style={{
                borderColor: styles.shellStyle.borderColor,
                color: styles.supportingColor,
              }}
            >
              {aiNarrationSlot}
            </div>
          ) : null}
        </div>

        {hasFooter ? (
          <div className="mt-auto flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-wrap gap-2">
              {chips.map((chip) => (
                <div
                  key={chip.id}
                  className="inline-flex min-h-[30px] max-w-full items-center border px-3 py-1 text-[11px] font-medium whitespace-nowrap"
                  style={{
                    ...styles.chipStyle,
                    color: styles.chipColor,
                    borderRadius: blockRadius,
                  }}
                >
                  {chip.text}
                </div>
              ))}
            </div>

            {brief?.action ? (
              <button
                type="button"
                onClick={() => onAction?.(brief.action)}
                className="inline-flex min-h-[40px] max-w-full items-center justify-center whitespace-nowrap border px-3.5 py-2 text-[12px] font-semibold tracking-[0.02em] transition duration-200 hover:brightness-105 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:w-auto"
                style={{
                  ...styles.buttonStyle,
                  borderRadius: blockRadius,
                }}
              >
                {brief.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
