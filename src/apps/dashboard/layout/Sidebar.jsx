import React, { memo } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

/**
 * Sidebar Component - Unified Console Layout
 * 
 * Single structure for all themes. Visual differences handled by CSS.
 * Uses semantic class names that can be styled per-theme.
 */
const Sidebar = memo(function Sidebar({
  tabs,
  activeTabId,
  onTabChange,
  onTabIntent = null,
  isOpen,
  isDocked,
  onClose,
  tabCues = null,
}) {
  const { t } = useAppTranslation('common');
  const mainTabs = tabs.filter((tab) => tab.id !== 'settings');
  const settingsTab = tabs.find((tab) => tab.id === 'settings');

  const shellClass = [
    'relative z-40 flex flex-col h-full w-full console-sidebar',
  ].join(' ');

  return (
    <aside
      id="dashboard-sidebar"
      className={shellClass}
      data-sidebar-placement="docked"
      aria-hidden="false"
      aria-label={t('navigation.main')}
    >
      <div className="sidebar-controls">
        {mainTabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          const hasArtifactDisclosureCue = tabCues?.[tab.id]?.artifactDisclosureUnseen === true;
          return (
            <button
              key={tab.id}
              type="button"
              className={[
                'nav-button',
                isActive ? 'is-active' : '',
                hasArtifactDisclosureCue ? 'has-artifact-disclosure-cue' : '',
              ].filter(Boolean).join(' ')}
              data-tab={tab.id}
              data-artifact-disclosure-cue={hasArtifactDisclosureCue ? 'unseen' : undefined}
              aria-label={tab.title || tab.navLabel}
              aria-current={isActive ? 'page' : undefined}
              aria-busy={tab.pending === true}
              disabled={tab.pending === true}
              onPointerEnter={() => onTabIntent?.(tab.id, { kind: 'pointerenter' })}
              onPointerDown={() => onTabIntent?.(tab.id, { kind: 'pointerdown' })}
              onFocus={() => onTabIntent?.(tab.id, { kind: 'focus' })}
              onClick={() => {
                onTabChange(tab.id);
              }}
            >
              <div className="nav-button-lamp" />
              <span className="nav-button-icon">
                {tab.navIcon && React.cloneElement(tab.navIcon, { className: 'w-5 h-5' })}
              </span>
              <span className="nav-button-label">{tab.navLabel}</span>
            </button>
          );
        })}

        {settingsTab && (
          <div className="settings-button-group">
            <button
              type="button"
              className={[
                'settings-button',
                activeTabId === settingsTab.id ? 'is-active' : '',
              ].filter(Boolean).join(' ')}
              data-tab={settingsTab.id}
              aria-current={activeTabId === settingsTab.id ? 'page' : undefined}
              onPointerEnter={() => onTabIntent?.(settingsTab.id, { kind: 'pointerenter' })}
              onPointerDown={() => onTabIntent?.(settingsTab.id, { kind: 'pointerdown' })}
              onFocus={() => onTabIntent?.(settingsTab.id, { kind: 'focus' })}
              onClick={() => {
                onTabChange(settingsTab.id);
              }}
            >
              <span className="nav-button-icon">
                {settingsTab.navIcon && React.cloneElement(settingsTab.navIcon, { className: 'w-5 h-5' })}
              </span>
              <span className="nav-button-label">{settingsTab.navLabel}</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.activeTabId === nextProps.activeTabId &&
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.isDocked === nextProps.isDocked &&
    prevProps.tabCues === nextProps.tabCues &&
    prevProps.tabs === nextProps.tabs &&
    prevProps.onTabIntent === nextProps.onTabIntent &&
    prevProps.onTabChange === nextProps.onTabChange &&
    prevProps.onClose === nextProps.onClose
  );
});

export default Sidebar;
