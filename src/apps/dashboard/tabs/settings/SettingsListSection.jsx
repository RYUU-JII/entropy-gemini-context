import React, { useState } from 'react';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { getDashboardStateTransitionStyle } from '@/themes/core/motion/index.js';
import {
  SETTINGS_CATEGORY_ORDER,
  TEXT_SHADOW_COLORS,
  TEXT_SHADOW_LEVELS,
  getCategoryEntries,
} from '../../../../domains/settings/config/settingsConfig.js';
import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../../domains/settings/config/index.js';
import SettingRow from '../../settings/controls/SettingRow.jsx';

const SETTINGS_ACCORDION_CARD_STYLE = getDashboardStateTransitionStyle('settings.list.card');
const SETTINGS_ACCORDION_CHEVRON_STYLE = getDashboardStateTransitionStyle('settings.list.chevron');
const SETTINGS_ACCORDION_BODY_STYLE = getDashboardStateTransitionStyle('settings.list.section-body');
const SETTINGS_BACK_LINK_STYLE = getDashboardStateTransitionStyle('dashboard.control.button');

export function getSettingEntry(settings, key) {
  if (settings && settings[key]) return settings[key];
  if (CONFIG_DEFAULT_FILTER_SETTINGS[key]) return CONFIG_DEFAULT_FILTER_SETTINGS[key];
  return { isActive: false, value: '' };
}

export default function SettingsListSection({
  settings,
  isOpen,
  showExperimental,
  onToggle,
  onValueChange,
  onShadowChange,
  onBack,
}) {
  const [expandedCategory, setExpandedCategory] = useState(SETTINGS_CATEGORY_ORDER[0]?.key);

  const toggleCategory = (key) => {
    setExpandedCategory(prev => prev === key ? null : key);
  };

  return (
    <div
      className={[
        'relative w-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3',
      ].join(' ')}
    >
      {onBack && (
        <div className="sticky top-0 z-20 mb-1 bg-[color-mix(in_srgb,var(--color-background)_92%,transparent)] pb-1 pt-0 backdrop-blur">
          <button
            onClick={onBack}
            className="group flex items-center gap-2 rounded-lg py-2 text-sm font-semibold text-on-surface-muted hover:text-on-surface"
            style={SETTINGS_BACK_LINK_STYLE}
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            돌아가기
          </button>
        </div>
      )}

      <div className="space-y-4 pb-6">
        <div className="space-y-3">
          {SETTINGS_CATEGORY_ORDER.map((catDef) => {
            const entries = getCategoryEntries(catDef.key, showExperimental);
            if (!entries || entries.length === 0) return null;

            const isExpanded = expandedCategory === catDef.key;

            return (
              <div
                key={catDef.key}
                className={[
                  'overflow-hidden rounded-theme-lg border',
                  isExpanded
                    ? 'border-accent bg-surface-elevated shadow-md'
                    : 'border-border bg-surface opacity-80 hover:opacity-100'
                ].join(' ')}
                style={SETTINGS_ACCORDION_CARD_STYLE}
              >
                <button
                  onClick={() => toggleCategory(catDef.key)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-inset"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full transition-colors ${isExpanded ? 'bg-accent' : 'bg-surface-elevated'}`} />
                    <h3 className={`text-base font-bold transition-colors ${isExpanded ? 'text-on-surface' : 'text-on-surface-muted'}`}>
                      {catDef.label}
                    </h3>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-on-surface-muted ${isExpanded ? 'rotate-180 text-accent' : ''}`}
                    style={SETTINGS_ACCORDION_CHEVRON_STYLE}
                    strokeWidth={2.5}
                  />
                </button>

                <div
                  className={`${isExpanded ? 'max-h-[800px] opacity-100 pb-6 pr-6 pl-6' : 'max-h-0 overflow-hidden opacity-0'}`}
                  style={SETTINGS_ACCORDION_BODY_STYLE}
                >
                  <div className="divide-y divide-border border-t border-border pt-2">
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
                          onShadowChange={onShadowChange}
                          isLast={idx === entries.length - 1}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
