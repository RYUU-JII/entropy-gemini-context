import { useMemo } from 'react';
import { useProtocolStore } from '@/apps/dashboard/stores/index.js';
import { useRuntimeParkedStoreSlice } from '../useRuntimeParkedStoreSlice.js';
import { createArtifactProjectionSelector } from './artifactProjectionIdentity.js';

export function useArtifactFamilyProtocolSlice(selectSlice, isActive) {
  const select = useMemo(() => createArtifactProjectionSelector(selectSlice), [selectSlice]);
  return useRuntimeParkedStoreSlice(useProtocolStore, select, isActive);
}
