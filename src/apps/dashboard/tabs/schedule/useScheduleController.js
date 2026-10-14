import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRuntimeParkedStoreSlice } from '../../hooks/useRuntimeParkedStoreSlice.js';
import { useProtocolStore } from '../../stores/useProtocolStore.js';
import { requireCanonicalSchedule } from '../../stores/protocolStoreHelpers.js';
import {
  areSchedulesEqual,
  normalizeSchedule,
  addScheduleBlock,
  removeScheduleBlock,
} from './scheduleModel.js';

const selectScheduleControllerProtocolSlice = (state) => ({
    schedule: state.schedule,
    setSchedule: state.setSchedule,
});

export function useScheduleController(isRuntimeActive = true) {
  const { schedule, setSchedule } = useRuntimeParkedStoreSlice(
    useProtocolStore,
    selectScheduleControllerProtocolSlice,
    isRuntimeActive,
  );
  const committedSchedule = useMemo(() => requireCanonicalSchedule(schedule), [schedule]);
  const [draftSchedule, setDraftSchedule] = useState(null);
  const [interactionDraft, setInteractionDraft] = useState(null);
  const activeSchedule = interactionDraft ?? draftSchedule ?? committedSchedule;
  const pendingCommittedScheduleRef = useRef(null);
  const [undoState, setUndoState] = useState(null);

  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [allowNoSelection, setAllowNoSelection] = useState(true);
  const selectedBlockIdRef = useRef(selectedBlockId);
  selectedBlockIdRef.current = selectedBlockId;
  const interactionSelectionRef = useRef(null);

  useEffect(() => {
    const pending = pendingCommittedScheduleRef.current;
    if (!pending) return;
    if (!areSchedulesEqual(committedSchedule, pending)) return;

    pendingCommittedScheduleRef.current = null;
    setDraftSchedule((currentDraft) => (
      areSchedulesEqual(currentDraft, pending) ? null : currentDraft
    ));
  }, [committedSchedule]);

  useEffect(() => {
    if (!activeSchedule?.blocks?.length) {
      if (selectedBlockId !== null) setSelectedBlockId(null);
      return;
    }

    if (!selectedBlockId) {
      if (!allowNoSelection) setSelectedBlockId(activeSchedule.blocks[0].id);
      return;
    }

    const exists = activeSchedule.blocks.some((block) => block.id === selectedBlockId);
    if (!exists) {
      if (allowNoSelection) {
        setSelectedBlockId(null);
      } else {
        setSelectedBlockId(activeSchedule.blocks[0].id);
      }
    }
  }, [activeSchedule?.blocks, allowNoSelection, selectedBlockId]);

  const commitSchedule = useCallback((nextSchedule, recordUndo = true) => {
    const resolved = normalizeSchedule(nextSchedule).schedule;
    const previous = draftSchedule ?? committedSchedule;
    setInteractionDraft(null);
    const previousSelection = interactionSelectionRef.current
      ? interactionSelectionRef.current.selectedBlockId : selectedBlockId;
    interactionSelectionRef.current = null;
    if (areSchedulesEqual(previous, resolved)) return;
    if (recordUndo) setUndoState({ schedule: previous, selectedBlockId: previousSelection });
    pendingCommittedScheduleRef.current = resolved;
    setDraftSchedule(resolved);

    const result = setSchedule(resolved);
    if (!result || typeof result.then !== 'function') {
      if (areSchedulesEqual(committedSchedule, resolved)) {
        pendingCommittedScheduleRef.current = null;
        setDraftSchedule(null);
      }
      return result;
    }

    result.catch(() => {
      // Keep the intended draft visible; the global sync surface owns retry/error feedback.
    });
    return result;
  }, [committedSchedule, draftSchedule, selectedBlockId, setSchedule]);

  const handleAddBlock = useCallback((options = {}) => {
    const result = addScheduleBlock(activeSchedule, options);
    commitSchedule(result.schedule);
    if (result.blockId) {
      setAllowNoSelection(false);
      setSelectedBlockId(result.blockId);
    }
    return result;
  }, [activeSchedule, commitSchedule]);

  const handleRemoveBlock = useCallback((blockId) => {
    const next = removeScheduleBlock(activeSchedule, blockId);
    if (blockId === selectedBlockId) {
      setAllowNoSelection(true);
      setSelectedBlockId(null);
    }
    commitSchedule(next);
  }, [activeSchedule, commitSchedule, selectedBlockId]);

  const handleSelectBlock = useCallback((blockId) => {
    setAllowNoSelection(false);
    setSelectedBlockId(blockId);
  }, []);

  const handleClearSelection = useCallback(() => {
    setAllowNoSelection(true);
    setSelectedBlockId(null);
  }, []);

  const handleDraftChange = useCallback((nextSchedule) => {
    if (nextSchedule && !interactionSelectionRef.current) {
      interactionSelectionRef.current = { selectedBlockId: selectedBlockIdRef.current };
    }
    if (!nextSchedule) interactionSelectionRef.current = null;
    setInteractionDraft(nextSchedule);
  }, []);

  const handleCommitSchedule = useCallback((nextSchedule) => {
    return commitSchedule(nextSchedule);
  }, [commitSchedule]);

  const handleUndo = useCallback(() => {
    if (!undoState) return;
    commitSchedule(undoState.schedule, false);
    setSelectedBlockId(undoState.selectedBlockId);
    setAllowNoSelection(undoState.selectedBlockId === null);
    setUndoState(null);
  }, [commitSchedule, undoState]);

  const handlers = useMemo(() => ({
    onAddBlock: handleAddBlock,
    onRemoveBlock: handleRemoveBlock,
    onSelectBlock: handleSelectBlock,
    onClearSelection: handleClearSelection,
    onDraftChange: handleDraftChange,
    onCommit: handleCommitSchedule,
    onUndo: handleUndo,
  }), [
    handleAddBlock,
    handleClearSelection,
    handleCommitSchedule,
    handleDraftChange,
    handleRemoveBlock,
    handleSelectBlock,
    handleUndo,
  ]);

  return {
    activeSchedule,
    selectedBlockId,
    canUndo: undoState !== null,
    handlers,
  };
}
