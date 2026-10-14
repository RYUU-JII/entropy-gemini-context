// Canonical routes remain distinct. This family groups only their Zen
// presentation and retained frame; it does not interpret launch parameters.
export function isZenGardenRoute(themeId, tabId) {
  return themeId === 'zen' && (tabId === 'main' || tabId === 'sites');
}

export function resolveDashboardPaneId(themeId, tabId) {
  return isZenGardenRoute(themeId, tabId) ? 'main' : tabId;
}

export function projectGardenSidebarTabs(tabs, themeId) {
  return themeId === 'zen' ? tabs.filter((tab) => tab.id !== 'sites') : tabs;
}
