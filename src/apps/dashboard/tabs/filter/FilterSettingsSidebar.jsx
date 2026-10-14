import React from 'react';
import { Aperture, Blinds, Hand, Settings } from 'lucide-react';
import { BarrierIcon } from '@/ui-kit/Icons.jsx';
import {
    getDashboardStateTransitionStyle,
    getInteractionMotionStyle,
} from '@/themes/core/motion/index.js';
import {
    SETTINGS_CATEGORY_ORDER,
    TEXT_SHADOW_COLORS,
    TEXT_SHADOW_LEVELS,
    getCategoryEntries,
    getSettingEntry,
} from '../../../../domains/settings/config/settingsConfig.js';
import SettingRow from '../../settings/controls/SettingRow.jsx';

const CATEGORY_ICONS = {
    lens: Aperture,
    veil: Blinds,
    brake: Hand,
    barrier: BarrierIcon,
};
const FILTER_SIDEBAR_INTERACTION_STYLE = getInteractionMotionStyle('stable');
const FILTER_CATEGORY_BUTTON_STYLE = getDashboardStateTransitionStyle('filter.sidebar.category');

export default function FilterSettingsSidebar({
    selectedCategory,
    onCategoryChange,
    settings,
    showExperimental,
    onToggle,
    onValueChange,
    onRangeInput,
    onRangeCommit,
    onShadowChange,
    onCompoundChange,
    categoryStats,
    embedded = false,
}) {
    const fallbackCatDef = SETTINGS_CATEGORY_ORDER.find((c) => c.key === selectedCategory) || SETTINGS_CATEGORY_ORDER[0];
    const currentCategory = categoryStats.find((cat) => cat.key === selectedCategory) || fallbackCatDef;
    const entries = getCategoryEntries(selectedCategory || fallbackCatDef.key, showExperimental);

    return (
        <aside className={[
            'flex shrink-0 flex-col bg-surface-elevated font-mono',
            embedded ? 'h-full min-h-0' : 'border-l border-border',
        ].join(' ')} style={FILTER_SIDEBAR_INTERACTION_STYLE}>
            <div className={[
                'grid grid-cols-2 gap-2 bg-surface/50 p-2.5',
                embedded ? 'border-b border-border' : 'border-b border-border',
            ].join(' ')}>
                {categoryStats.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat.key] || Settings;
                    const isSelected = selectedCategory === cat.key;
                    const hasActive = cat.active > 0;

                    return (
                        <button
                            key={cat.key}
                            onClick={() => onCategoryChange(cat.key)}
                            title={cat.label}
                            className={[
                                'relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl',
                                isSelected
                                    ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                                    : 'bg-surface text-on-surface-muted hover:bg-surface-elevated hover:text-on-surface',
                            ].join(' ')}
                            style={FILTER_CATEGORY_BUTTON_STYLE}
                        >
                            <Icon className="h-6 w-6" strokeWidth={isSelected ? 2.5 : 2} />
                            <span className="text-[9px] font-black uppercase tracking-wide">{cat.label}</span>
                            {hasActive && (
                                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 text-[8px] font-black text-accent">
                                    {cat.active}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border bg-surface/50 px-4 py-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface">
                        {currentCategory?.label || fallbackCatDef?.label}
                    </h3>
                </div>

                <div className="custom-scrollbar flex-1 divide-y divide-border overflow-y-auto overflow-x-hidden px-4">
                    {entries.map(([key, meta], idx) => {
                        const setting = getSettingEntry(settings, key);
                        return (
                            <SettingRow
                                key={key}
                                settingKey={key}
                                meta={meta}
                                setting={setting}
                                shadowColors={TEXT_SHADOW_COLORS}
                                shadowLevels={TEXT_SHADOW_LEVELS}
                                onToggle={onToggle}
                                onValueChange={onValueChange}
                                onRangeInput={onRangeInput}
                                onRangeCommit={onRangeCommit}
                                onShadowChange={onShadowChange}
                                onCompoundChange={onCompoundChange}
                                isLast={idx === entries.length - 1}
                            />
                        );
                    })}

                    {currentCategory?.description && (
                        <div className="py-6 opacity-40">
                            <p className="text-[10px] italic leading-relaxed text-on-surface-muted">
                                {currentCategory.description}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-auto flex items-center justify-between border-t border-border bg-surface/30 px-4 py-2 text-[8px] font-bold uppercase tracking-widest text-on-surface-muted">
                <span>{embedded ? 'Artifact Tuning' : 'Artifacts Editor'}</span>
                <span className="flex items-center gap-1">
                    READY <div className="h-1 w-1 rounded-full bg-success" />
                </span>
            </div>
        </aside>
    );
}
