import React from 'react';
import { ChevronRight } from 'lucide-react';
const FLOW_HINT_ORDER = Object.freeze(['role', 'cause', 'channel', 'result']);
const FLOW_HINT_LABELS = Object.freeze({
  role: '역할',
  cause: '원인',
  channel: '채널',
  result: '결과'
});
const renderFlowHint = flowHint => {
  if (!flowHint || typeof flowHint !== 'object') return null;
  const rows = FLOW_HINT_ORDER.filter(key => typeof flowHint[key] === 'string' && flowHint[key].length > 0).map(key => ({
    key,
    label: FLOW_HINT_LABELS[key] || key,
    value: flowHint[key]
  }));
  if (rows.length === 0) return null;
  return <div className="rounded-lg border border-border/30 bg-surface-sunken/35 px-3 py-2.5">
            <div className="space-y-1.5">
                {rows.map(row => <div key={row.key} className="flex items-start gap-2">
                        <span className="mt-[2px] rounded-md bg-surface/60 px-1.5 py-0.5 text-[8px] font-bold text-on-surface-muted">
                            {row.label}
                        </span>
                        <span className="min-w-0 break-words text-[10px] leading-relaxed text-on-surface-muted">
                            {row.value}
                        </span>
                    </div>)}
            </div>
        </div>;
};
export default function ControlGroupCard({
  group,
  isOpen,
  onToggle,
  t,
  renderBadge,
  renderKoiColorStrategy,
  renderGroupParams,
  renderCustomPanel
}) {
  const customPanel = typeof renderCustomPanel === 'function' ? renderCustomPanel(group) : null;
  return <div className="overflow-hidden rounded-lg border border-border/30 bg-surface/15 transition-all">
            <button type="button" onClick={() => onToggle(group.id)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-surface/30 active:bg-surface/40">
                <span className={`text-sm transition-transform ${isOpen ? 'scale-110' : 'opacity-70 grayscale'}`}>
                    {group.icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-on-surface">
                    {t(`tools:koi_tuner.groups.${group.id}`, {})}
                </span>
                {renderBadge(group.badge)}
                <ChevronRight className={`h-3 w-3 shrink-0 text-on-surface-muted transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
            </button>

            {isOpen && <div className="border-t border-border/20 px-4 py-4">
                    <div className="flex flex-col gap-5">
                        {renderFlowHint(group.flowHint)}
                        {(group.id === 'koiBody' || group.id === 'koiLook') && typeof renderKoiColorStrategy === 'function' ? renderKoiColorStrategy() : null}
                        {customPanel ? customPanel : renderGroupParams(group)}
                    </div>
                </div>}
        </div>;
}
