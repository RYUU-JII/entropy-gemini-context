#!/usr/bin/env node
/**
 * CLI Runner for Entropy Sound Lab Catalog Scanner.
 */

import { scanSoundCatalog } from './scanner/soundCatalogScanner.js';

function runCli() {
  console.log('\n========================================================');
  console.log('   ENTROPY SOUND LAB - SOUND CATALOG & SYNTH SCANNER');
  console.log('========================================================\n');

  const report = scanSoundCatalog();
  const { summary, themeMetrics, items } = report;

  console.log(`Scan Timestamp: ${report.timestamp}`);
  console.log(`Total Sound Targets: ${summary.totalTargets}`);
  console.log(`Active Synth Implemented: ${summary.totalSynth}`);
  console.log(`Verified Audio Assets: ${summary.totalAsset}`);
  console.log(`Withheld Silent Cues: ${summary.totalSilent}`);
  console.log(`Planned / Backlog: ${summary.totalPlanned}`);
  console.log(`Overall Completion Rate: ${summary.overallCompletionRate}%\n`);

  console.log('--- THEME BREAKDOWN ---');
  for (const [theme, m] of Object.entries(themeMetrics)) {
    const rateBar = '█'.repeat(Math.round(m.completionRate / 10)) + '░'.repeat(10 - Math.round(m.completionRate / 10));
    console.log(`[${theme.toUpperCase().padEnd(10)}] ${rateBar} ${m.completionRate.toFixed(1)}% (${m.implementedCount}/${m.total}) [Synth: ${m.synthCount}, Silent: ${m.silentCount}, Planned: ${m.plannedCount}]`);
  }

  console.log('\n--- SOUND TARGETS LEDGER ---');
  for (const item of items) {
    const statusTag = item.liveStatus === 'SYNTH' ? '\x1b[32m[SYNTH]\x1b[0m'
      : item.liveStatus === 'ASSET' ? '\x1b[34m[ASSET]\x1b[0m'
      : item.liveStatus === 'SILENT' ? '\x1b[33m[SILENT]\x1b[0m'
      : '\x1b[90m[PLANNED]\x1b[0m';

    console.log(`${statusTag} ${item.id.padEnd(42)} (${item.theme} / ${item.kind.toUpperCase()} / ${item.bus}) - ${item.name}`);
  }

  console.log('\n========================================================');
  console.log('To open the local Sound Lab review workspace:');
  console.log('  npm run build:sound-lab');
  console.log('  npm run dev:sound-lab');
  console.log('  Open http://127.0.0.1:4186/');
  console.log('========================================================\n');
}

runCli();
