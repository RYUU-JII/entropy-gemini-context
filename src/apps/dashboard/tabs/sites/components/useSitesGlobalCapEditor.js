import { clampGlobalGoalMinutes } from './sitesGlobalCapModel.js';
import { useSitesCapEditor } from './useSitesCapEditor.js';

export function useSitesGlobalCapEditor({ onGlobalGoalChange, ...options }) {
  return useSitesCapEditor({ ...options, normalizeGoal: clampGlobalGoalMinutes, onSave: async (minutes) => {
    if (typeof onGlobalGoalChange !== 'function') throw new Error('SITES_GLOBAL_GOAL_CHANGE_HANDLER_REQUIRED');
    await onGlobalGoalChange(minutes);
    return minutes;
  } });
}
