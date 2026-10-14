import { requireArtifactControlState } from '../../../settings/config/artifactControlState.js';
import { requireProtectedTabGroupsState } from '../../../../platform/storage/runtime/ProtectedTabGroupsRepository.js';

const webUrl = value => typeof value === 'string' && /^https?:\/\//.test(value);
const validId = value => Number.isInteger(value) && value >= 0;

function requireInventory(inventory) {
  if (!Array.isArray(inventory?.protectedTabs) || !Number.isInteger(inventory.protectedTabCount)
    || inventory.protectedTabCount !== inventory.protectedTabs.length) throw new Error('TAB_GROUP_INVENTORY_INVALID');
  return inventory;
}

// Native groups are an optional presentation projection. Protection scope,
// budgets and Gate authority remain owned by the canonical inventory/session.
export function createProtectedTabGroupService({ browserPort, repository, readSettings, readProtectedTabInventory, readGateSession }) {
  for (const method of ['tabsQuery', 'tabsGet', 'tabsGroup', 'tabsUngroup', 'tabGroupsQuery', 'tabGroupsUpdate', 'permissionsContains', 'setBadge']) {
    if (typeof browserPort?.[method] !== 'function') throw new Error(`TAB_GROUP_BROWSER_PORT_REQUIRED:${method}`);
  }
  if (typeof repository?.read !== 'function' || typeof repository?.write !== 'function'
    || typeof readSettings !== 'function' || typeof readProtectedTabInventory !== 'function'
    || typeof readGateSession !== 'function') throw new Error('TAB_GROUP_OWNERS_REQUIRED');

  let tail = Promise.resolve();
  let badgeText = null;
  function serialize(task) {
    const result = tail.then(task, task);
    tail = result;
    return result;
  }
  async function badge(text) {
    if (badgeText === text) return;
    await browserPort.setBadge(text);
    badgeText = text;
  }
  async function readEffectiveState() {
    const settings = await readSettings();
    if (typeof settings?.tabManagement?.groupProtectedTabs !== 'boolean') throw new Error('TAB_MANAGEMENT_SETTINGS_REQUIRED');
    const control = requireArtifactControlState(settings.artifactControlState);
    if (!settings.tabManagement.groupProtectedTabs || control.globalPaused || control.familySuspensions.barrier) {
      await badge('');
      return { status: 'disabled' };
    }
    if (!await browserPort.permissionsContains({ permissions: ['tabGroups'] })) {
      await badge('');
      return { status: 'permission_required' };
    }
    const inventory = requireInventory(await readProtectedTabInventory({ now: Date.now() }));
    await badge(inventory.protectedTabCount === 0 ? '' : String(inventory.protectedTabCount));
    return { status: 'enabled', inventory };
  }
  async function mutationStillEnabled() {
    const settings = await readSettings();
    if (typeof settings?.tabManagement?.groupProtectedTabs !== 'boolean') throw new Error('TAB_MANAGEMENT_SETTINGS_REQUIRED');
    const control = requireArtifactControlState(settings.artifactControlState);
    return settings.tabManagement.groupProtectedTabs && !control.globalPaused && !control.familySuspensions.barrier
      && await browserPort.permissionsContains({ permissions: ['tabGroups'] });
  }

  async function observe(tabId = null) {
    const effective = await readEffectiveState();
    if (effective.status !== 'enabled') return effective;
    const state = requireProtectedTabGroupsState(await repository.read());
    const [tabs, groups] = await Promise.all([browserPort.tabsQuery({}), browserPort.tabGroupsQuery({})]);
    if (!Array.isArray(tabs) || !Array.isArray(groups)) throw new Error('TAB_GROUP_BROWSER_INVENTORY_INVALID');
    const liveIds = new Set(tabs.map(tab => tab.id));
    const liveGroups = new Map(groups.map(group => [group.id, group]));
    state.processedTabIds = state.processedTabIds.filter(id => liveIds.has(id));
    for (const [windowId, groupId] of Object.entries(state.groupsByWindowId)) {
      if (liveGroups.get(groupId)?.windowId !== Number(windowId)) delete state.groupsByWindowId[windowId];
    }
    const protectedIds = new Set(effective.inventory.protectedTabs.map(tab => tab.tabId));
    const retainedMembers = [];
    let removedUnprotectedMember = false;
    for (const memberId of state.memberTabIds) {
      const member = tabs.find(tab => tab.id === memberId);
      if (!member || state.groupsByWindowId[member.windowId] !== member.groupId) continue;
      if (!protectedIds.has(memberId) && !await readGateSession(memberId)) {
        const latestInventory = requireInventory(await readProtectedTabInventory({ now: Date.now() }));
        if (latestInventory.protectedTabs.some(item => item.tabId === memberId) || !await mutationStillEnabled()) {
          retainedMembers.push(memberId);
          continue;
        }
        const currentMember = await browserPort.tabsGet(memberId);
        if (!currentMember || currentMember.windowId !== member.windowId || currentMember.groupId !== member.groupId) continue;
        if (currentMember.url !== member.url || currentMember.pendingUrl || currentMember.pinned) {
          retainedMembers.push(memberId);
          continue;
        }
        await browserPort.tabsUngroup([memberId]);
        removedUnprotectedMember = true;
        state.processedTabIds = state.processedTabIds.filter(id => id !== memberId);
      } else {
        retainedMembers.push(memberId);
      }
    }
    state.memberTabIds = retainedMembers;
    if (removedUnprotectedMember) {
      // Chrome removes an empty group with its last member. Reconcile before
      // assigning another tab so a just-deleted group is never reused.
      const remainingGroups = await browserPort.tabGroupsQuery({});
      if (!Array.isArray(remainingGroups)) throw new Error('TAB_GROUP_BROWSER_INVENTORY_INVALID');
      const remainingById = new Map(remainingGroups.map(group => [group.id, group]));
      for (const [windowId, groupId] of Object.entries(state.groupsByWindowId)) {
        if (remainingById.get(groupId)?.windowId !== Number(windowId)) delete state.groupsByWindowId[windowId];
      }
    }
    await repository.write(state);
    if (!validId(tabId)) return { status: 'refreshed' };
    const protectedTab = effective.inventory.protectedTabs.find(tab => tab.tabId === tabId);
    const tab = tabs.find(item => item.id === tabId);
    if (!protectedTab || !tab || !webUrl(tab.url) || tab.pendingUrl || await readGateSession(tabId)) return { status: 'ineligible' };
    if (state.processedTabIds.includes(tabId)) return { status: 'already_processed' };

    // Mark before mutation: a worker death must not undo a user's later manual
    // removal. Existing/user-restored groups are never claimed by their title.
    state.processedTabIds.push(tabId);
    await repository.write(state);
    if (tab.pinned || tab.groupId !== -1 || !validId(tab.windowId)) return { status: 'user_organization' };
    async function cancelUnissuedMutation(status) {
      state.processedTabIds = state.processedTabIds.filter(id => id !== tabId);
      await repository.write(state);
      return { status };
    }

    const current = await browserPort.tabsGet(tabId);
    if (current && (current.pinned || current.groupId !== -1)) return { status: 'user_organization' };
    if (!current || current.url !== tab.url || current.windowId !== tab.windowId
      || current.groupId !== -1 || current.pinned || current.pendingUrl || await readGateSession(tabId)) return cancelUnissuedMutation('superseded');
    // Recheck the preference and grant after all asynchronous reads. A queued
    // setting change cannot authorize a new group mutation from an old read.
    if (!await mutationStillEnabled()) return cancelUnissuedMutation('cancelled');
    const latestInventory = requireInventory(await readProtectedTabInventory({ now: Date.now() }));
    if (!latestInventory.protectedTabs.some(item => item.tabId === tabId && item.url === current.url)) return cancelUnissuedMutation('scope_changed');
    if (await readGateSession(tabId)) return cancelUnissuedMutation('superseded');

    // Native organization can change while policy readers are pending. The last
    // await before tabs.group must observe the actual tab, not an earlier copy.
    const mutationTab = await browserPort.tabsGet(tabId);
    if (mutationTab && (mutationTab.pinned || mutationTab.groupId !== -1)) return { status: 'user_organization' };
    if (!mutationTab || mutationTab.url !== current.url || mutationTab.windowId !== current.windowId
      || mutationTab.pendingUrl) return cancelUnissuedMutation('superseded');

    const existingGroupId = state.groupsByWindowId[tab.windowId];
    let groupId;
    try {
      groupId = await browserPort.tabsGroup(existingGroupId === undefined
        ? { tabIds: [tabId], createProperties: { windowId: tab.windowId } }
        : { tabIds: [tabId], groupId: existingGroupId });
    } catch (error) {
      // Retry is safe only when the live browser proves that no grouping took
      // effect. Never infer a successful mutation or claim an unknown group.
      const settled = await browserPort.tabsGet(tabId);
      if (settled?.groupId === -1) await cancelUnissuedMutation('group_failed');
      throw error;
    }
    if (!validId(groupId)) throw new Error('TAB_GROUP_CREATE_RESULT_INVALID');
    state.memberTabIds.push(tabId);
    state.groupsByWindowId[tab.windowId] = groupId;
    await repository.write(state);
    if (existingGroupId === undefined) {
      await browserPort.tabGroupsUpdate(groupId, { title: 'Entropy', color: 'grey' });
    }
    return { status: 'grouped', tabId, groupId };
  }

  async function releaseForGate(tabId) {
    if (!validId(tabId)) throw new Error('TAB_GROUP_TAB_ID_INVALID');
    const state = requireProtectedTabGroupsState(await repository.read());
    if (!state.memberTabIds.includes(tabId)) return { status: 'unmanaged' };
    const tab = await browserPort.tabsGet(tabId);
    if (!tab || state.groupsByWindowId[tab.windowId] !== tab.groupId) return { status: 'unmanaged' };
    await browserPort.tabsUngroup([tabId]);
    // This removal belongs to Gate navigation, so successful content resume
    // may join once again. Manual removals retain their processed marker.
    state.processedTabIds = state.processedTabIds.filter(id => id !== tabId);
    state.memberTabIds = state.memberTabIds.filter(id => id !== tabId);
    await repository.write(state);
    return { status: 'released', tabId };
  }

  return {
    observeTab: tabId => serialize(() => observe(tabId)),
    refresh: () => serialize(() => observe()),
    organizeOpenTabs: () => serialize(async () => {
      const effective = await readEffectiveState();
      if (effective.status !== 'enabled') return effective;
      const results = [];
      for (const tab of effective.inventory.protectedTabs) results.push(await observe(tab.tabId));
      return { status: 'organized', results };
    }),
    beforeGateNavigation: tabId => serialize(() => releaseForGate(tabId)),
  };
}
