import { getHostname } from '../../../lib/index.js';

// A last-focused window's active tab is not evidence of current foreground.
// Both batch settlement and consumption classification use this same proof.
export function resolveObservedForegroundTab({ tabs, focusedActiveTabs, focusedWindow }) {
  if (!Array.isArray(tabs) || !Array.isArray(focusedActiveTabs)) {
    throw new Error('TRACKING_FOREGROUND_INVENTORY_INVALID');
  }
  if (focusedWindow?.focused !== true || !Number.isInteger(focusedWindow.id) || focusedWindow.id < 0) return null;
  const candidates = focusedActiveTabs.filter((tab) => tab.active === true
    && tab.windowId === focusedWindow.id && Number.isInteger(tab.id) && tab.id >= 0);
  if (candidates.length !== 1) return null;
  const candidate = candidates[0];
  const matches = tabs.filter((tab) => tab.id === candidate.id);
  if (matches.length !== 1) return null;
  const tab = matches[0];
  if (tab.url !== candidate.url || tab.active !== true || tab.windowId !== focusedWindow.id) return null;
  if ([tab, candidate].some((entry) => entry.pendingUrl
    && getHostname(entry.pendingUrl) !== getHostname(entry.url))) return null;
  return tab;
}
