import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getFreshDashboardPermissionSnapshot,
  readDashboardPermissionSnapshot,
  subscribeDashboardPermissionSnapshotChanges,
} from '../capabilities/browserPermissionSnapshotResource.js';
import {
  buildProtectionArtifactCapabilityState,
  createPermissionSnapshotReadError,
  EMPTY_PERMISSION_SNAPSHOT,
  normalizePermissionSnapshot,
} from '../utils/protectionArtifactCapabilityState.js';

const EMPTY_URL_LIST = Object.freeze([]);
const EMPTY_ARTIFACT_FAMILIES = Object.freeze({});

function arePermissionSnapshotsEqual(left, right) {
  if (left === right) return true;
  if (left?.readError !== right?.readError) return false;
  const leftPermissions = Array.isArray(left?.permissions) ? left.permissions : EMPTY_URL_LIST;
  const rightPermissions = Array.isArray(right?.permissions) ? right.permissions : EMPTY_URL_LIST;
  const leftOrigins = Array.isArray(left?.origins) ? left.origins : EMPTY_URL_LIST;
  const rightOrigins = Array.isArray(right?.origins) ? right.origins : EMPTY_URL_LIST;
  return leftPermissions.length === rightPermissions.length
    && leftOrigins.length === rightOrigins.length
    && leftPermissions.every((value, index) => value === rightPermissions[index])
    && leftOrigins.every((value, index) => value === rightOrigins[index]);
}

export function useProtectionArtifactCapabilityState({
  isActive = true,
  permissionMode = 'selective',
  blockedUrls = EMPTY_URL_LIST,
  allowedUrls = EMPTY_URL_LIST,
  artifactFamilies = EMPTY_ARTIFACT_FAMILIES,
} = {}) {
  const [permissionSnapshot, setPermissionSnapshot] = useState(() => {
    if (!isActive) return EMPTY_PERMISSION_SNAPSHOT;
    const freshSnapshot = getFreshDashboardPermissionSnapshot();
    return freshSnapshot
      ? normalizePermissionSnapshot(freshSnapshot)
      : EMPTY_PERMISSION_SNAPSHOT;
  });
  const permissionCommitOwnerRef = useRef({
    generation: 0,
    isActive,
  });
  if (permissionCommitOwnerRef.current.isActive !== isActive) {
    permissionCommitOwnerRef.current = {
      generation: permissionCommitOwnerRef.current.generation + 1,
      isActive,
    };
  }

  const readPermissionSnapshot = useCallback(async ({ force = false } = {}) => {
    if (!isActive) {
      return EMPTY_PERMISSION_SNAPSHOT;
    }
    const requestGeneration = permissionCommitOwnerRef.current.generation + 1;
    permissionCommitOwnerRef.current.generation = requestGeneration;
    let nextSnapshot;
    try {
      nextSnapshot = normalizePermissionSnapshot(await readDashboardPermissionSnapshot({ force, tabId: 'tools' }));
    } catch (error) {
      if (permissionCommitOwnerRef.current.isActive && permissionCommitOwnerRef.current.generation === requestGeneration) {
        setPermissionSnapshot(createPermissionSnapshotReadError(error));
      }
      throw error;
    }
    if (
      permissionCommitOwnerRef.current.isActive
      && permissionCommitOwnerRef.current.generation === requestGeneration
    ) {
      setPermissionSnapshot((current) => (
        arePermissionSnapshotsEqual(current, nextSnapshot) ? current : nextSnapshot
      ));
    }
    return nextSnapshot;
  }, [isActive]);

  const refreshPermissionSnapshot = useCallback(
    () => readPermissionSnapshot({ force: true }),
    [readPermissionSnapshot],
  );

  useEffect(() => {
    if (!isActive) return undefined;
    return subscribeDashboardPermissionSnapshotChanges(() => {
      void refreshPermissionSnapshot().catch(() => undefined); // The read owner publishes the error state.
    });
  }, [isActive, refreshPermissionSnapshot]);

  useEffect(() => {
    if (!isActive) return undefined;
    // The generation-fenced read owner publishes failures as well as success.
    void readPermissionSnapshot().catch(() => undefined);
    return undefined;
  }, [
    allowedUrls,
    artifactFamilies?.echo?.children?.bookmarkConceal?.configuredEnabled,
    artifactFamilies?.echo?.children?.bookmarkConceal?.enabled,
    artifactFamilies?.echo?.children?.historyCleanup?.configuredEnabled,
    artifactFamilies?.echo?.children?.historyCleanup?.enabled,
    blockedUrls,
    isActive,
    permissionMode,
    readPermissionSnapshot,
  ]);

  const capabilityState = useMemo(() => buildProtectionArtifactCapabilityState({
    permissionSnapshot,
    permissionMode,
    blockedUrls,
    allowedUrls,
    artifactFamilies,
  }), [
    allowedUrls,
    artifactFamilies,
    blockedUrls,
    permissionMode,
    permissionSnapshot,
  ]);

  return {
    artifactCapabilityState: capabilityState,
    refreshArtifactCapabilityState: refreshPermissionSnapshot,
  };
}

export default useProtectionArtifactCapabilityState;
