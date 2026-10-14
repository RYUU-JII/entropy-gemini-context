export async function executeQaExplorationCommand(parsed, { rootDir, signal = null } = {}) {
  const action = parsed.explorationAction;
  if (action === 'inspect') {
    const { readQaExplorationGuide, renderQaExplorationGuide } = await import('./qaExplorationGuide.mjs');
    const guide = await readQaExplorationGuide({ rootDir,
      comparison: parsed.options.comparison === undefined ? null : parsed.options.comparison });
    process.stdout.write(parsed.options.json === true ? JSON.stringify(guide, null, 2) + '\n' : renderQaExplorationGuide(guide));
    return Object.freeze({ exitCode: 0, guide });
  }
  if (action === 'show') {
    const { inspectQaExplorationSession } = await import('../exploration/qaExplorationRecovery.mjs');
    const session = await inspectQaExplorationSession({ rootDir, sessionId: parsed.sessionId });
    process.stdout.write(parsed.options.json === true ? JSON.stringify(session, null, 2) + '\n'
      : `Exploration ${session.sessionId}: current ${session.currentStatus}; recorded ${session.recordedStatus}; ${session.notes.length} observation(s); no named QA verdict\nRecovery: ${session.recoveryAction}\nEvidence: ${session.sessionRoot}\n`);
    return Object.freeze({ exitCode: ['ABANDONED', 'UNVERIFIED'].includes(session.currentStatus) ? 2
      : session.status === 'FAILED' ? 1 : 0, session });
  }
  if (action === 'recover') {
    const { recoverQaExplorationSession } = await import('../exploration/qaExplorationRecovery.mjs');
    const recovery = await recoverQaExplorationSession({ rootDir, sessionId: parsed.sessionId });
    process.stdout.write(parsed.options.json === true ? JSON.stringify(recovery, null, 2) + '\n'
      : `Exploration ${recovery.sessionId}: ${recovery.status}; original session/notes and browser preserved; no named QA verdict\nEvidence: ${recovery.evidencePath}\n`);
    return Object.freeze({ exitCode: 0, recovery });
  }
  const { runQaExplorationSession, recordQaExplorationObservation } = await import('../exploration/qaExplorationSession.mjs');
  if (action === 'note') {
    const note = await recordQaExplorationObservation({ rootDir, sessionId: parsed.sessionId,
      actions: parsed.options.actions, observation: parsed.options.observation, uncertainty: parsed.options.uncertainty });
    process.stdout.write(parsed.options.json === true ? JSON.stringify(note, null, 2) + '\n'
      : `Observation saved for ${note.sessionId}\nEvidence: ${note.evidencePath}\n`);
    return Object.freeze({ exitCode: 0, note });
  }
  const session = await runQaExplorationSession({ rootDir, signal,
    onReady: async (receipt) => {
      process.stdout.write(JSON.stringify({ event: 'QA_EXPLORATION_READY', ...receipt }) + '\n');
      if (parsed.options.json !== true) process.stdout.write('Keep this runner alive during connected UI exploration. Verify the exact connected profile/tab, then use qa explore note <session-id>. Ctrl-C releases the leases.\n');
    } });
  process.stdout.write(JSON.stringify({ event: 'QA_EXPLORATION_CLOSED', ...session }) + '\n');
  return Object.freeze({ exitCode: 0, session });
}
