import React from 'react';

function resolveToneTheme(tone = 'muted') {
  switch (tone) {
    case 'active':
      return {
        container: 'border-accent/20 bg-surface text-on-surface',
        eyebrow: 'text-accent',
        action: 'border-accent/20 bg-surface-elevated/35 text-accent hover:border-accent/35 hover:bg-surface',
      };
    case 'ok':
      return {
        container: 'border-success/25 bg-surface text-on-surface',
        eyebrow: 'text-success',
        action: 'border-success/20 bg-surface-elevated/35 text-success hover:border-success/35 hover:bg-surface',
      };
    case 'warn':
      return {
        container: 'border-warning/25 bg-surface text-on-surface',
        eyebrow: 'text-warning',
        action: 'border-warning/20 bg-surface-elevated/35 text-warning hover:border-warning/35 hover:bg-warning/10',
      };
    case 'alert':
      return {
        container: 'border-danger/25 bg-surface text-on-surface',
        eyebrow: 'text-danger',
        action: 'border-danger/20 bg-surface-elevated/35 text-danger hover:border-danger/35 hover:bg-danger/10',
      };
    default:
      return {
        container: 'border-border/35 bg-surface-elevated/35 text-on-surface',
        eyebrow: 'text-on-surface-muted/70',
        action: 'border-border/35 bg-surface text-on-surface-muted hover:border-accent/25 hover:bg-surface-elevated hover:text-on-surface',
      };
  }
}

export default function ProtectionInsightCards({
  cards = [],
  columns = 1,
  className = '',
  labels = {},
  onAction = null,
}) {
  if (!cards.length) return null;

  const gridClassName = columns > 1
    ? 'grid-cols-1 xl:grid-cols-2'
    : 'grid-cols-1';

  return (
    <div className={['grid gap-3', gridClassName, className].filter(Boolean).join(' ')}>
      {cards.map((card) => {
        const toneTheme = resolveToneTheme(card.tone);

        return (
          <article
            key={card.id}
            className={`rounded-[10px] border px-4 py-4 ${toneTheme.container}`}
          >
            <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${toneTheme.eyebrow}`}>
              {card.id === 'intervention'
                ? (labels.intervention || 'Recent intervention')
                : (labels.target || 'Target fit')}
            </div>
            <h3 className="mt-2 text-[16px] font-black tracking-tight text-on-surface">{card.title}</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-on-surface-muted/88">{card.body}</p>
            {card.meta ? (
              <div className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted/70">{card.meta}</div>
            ) : null}
            {typeof onAction === 'function' && Array.isArray(card.actions) && card.actions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {card.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onAction(action, card)}
                    className={`inline-flex items-center rounded-[10px] border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${toneTheme.action}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
