#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const docsDir = path.resolve(rootDir, 'docs');
const allowedDocsRootEntries = new Set([
  'README.md',
  'system-architecture',
  'governance',
  'architecture',
  'product',
  'domains',
  'apps',
  'operations',
  'migrations',
  'decisions',
  'archive',
  'templates'
]);
const activeVersionNamePattern = /(?:^|[-_])v\d+(?:\.\d+)*\.md$/i;
const activeFinalNamePattern = /(?:^|[-_])final(?:[-_]|\.)/i;
const markdownLinkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
const inlineCodePattern = /`([^`\n]+)`/g;
const fencedCodePattern = /```[\s\S]*?```/g;
const historicalPathPattern = /src\/(?:entries|shared|features)\/|StatsCache\.js/u;
const requiredHistoricalNote = '> Historical path note:';
const governedDocPrefixes = [
  'docs/system-architecture/',
  'docs/governance/',
  'docs/architecture/',
  'docs/product/',
  'docs/domains/',
  'docs/apps/',
  'docs/operations/',
  'docs/migrations/',
  'docs/decisions/'
];
const requiredMetadataKeys = [
  'Status',
  'Owner',
  'Last validated against code',
  'Path policy'
];
const statusSpecificMetadata = new Map([
  ['Active', ['Canonical for']],
  ['Proposed', ['Decision needed']],
  ['Migration', ['Exit criteria']]
]);
const allowedStatuses = new Set([
  'Active',
  'Draft',
  'Proposed',
  'Hold',
  'Migration',
  'Archived'
]);
const allowedPathPolicies = new Set(['current-only', 'planning-allowed']);
const validatedDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const fail = (messages) => {
  const lines = Array.isArray(messages) ? messages : [messages];
  for (const line of lines) {
    console.error(`[docs:paths] FAIL: ${line}`);
  }
  process.exit(1);
};

async function walkMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walkMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function toRepoPath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, '/');
}

function isActiveDoc(repoPath) {
  if (repoPath === 'README.md' || repoPath === 'AGENTS.md') return true;
  if (repoPath.startsWith('src/') && repoPath.endsWith('/README.md')) return true;
  if (repoPath.startsWith('docs/') && !repoPath.startsWith('docs/archive/')) return true;
  return false;
}

function isGovernedDoc(repoPath) {
  if (repoPath.startsWith('docs/system-architecture/')) return true;
  if (repoPath.endsWith('/README.md')) return false;
  return governedDocPrefixes.some((prefix) => repoPath.startsWith(prefix));
}

function parseTopMetadata(source) {
  const metadata = new Map();
  const lines = source.split(/\r?\n/).slice(0, 40);
  for (const line of lines) {
    const match = line.match(/^- ([A-Za-z][A-Za-z ]+):\s*(.+)$/);
    if (!match) continue;
    metadata.set(match[1], match[2].trim());
  }
  return metadata;
}

function shouldSkipInlinePathValidation(repoPath, metadata) {
  return metadata.get('Path policy') === 'planning-allowed';
}

function shouldResolvePathToken(token) {
  return token === 'README.md'
    || token === 'AGENTS.md'
    || token === 'package.json'
    || token.startsWith('./')
    || token.startsWith('../')
    || token.startsWith('docs/')
    || token.startsWith('src/')
    || token.startsWith('scripts/')
    || token.startsWith('tests/');
}

function looksLikePathToken(token) {
  if (!shouldResolvePathToken(token)) return false;
  if (token.includes('*') || token.includes('{') || token.includes('}') || token.includes(' ')) return false;
  return /^[A-Za-z0-9._/\-]+$/.test(token);
}

function resolveReference(rawToken, filePath) {
  const token = rawToken.split('#')[0].split('?')[0];
  if (!token) return null;
  if (/^(?:https?:|mailto:)/i.test(token)) return null;
  if (token.startsWith('#')) return null;
  if (!looksLikePathToken(token)) return null;

  if (token.startsWith('./') || token.startsWith('../')) {
    return path.resolve(path.dirname(filePath), token);
  }
  return path.resolve(rootDir, token);
}

async function validateDocsRoot() {
  const entries = await fs.readdir(docsDir, { withFileTypes: true });
  const unexpected = entries
    .map((entry) => entry.name)
    .filter((name) => !allowedDocsRootEntries.has(name))
    .sort();

  if (unexpected.length) {
    fail(`unexpected top-level docs entries: ${unexpected.join(', ')}`);
  }
}

async function validateActiveNames(markdownFiles) {
  const failures = [];
  for (const filePath of markdownFiles) {
    const repoPath = toRepoPath(filePath);
    if (!isActiveDoc(repoPath)) continue;
    const baseName = path.basename(filePath);
    if (activeVersionNamePattern.test(baseName)) {
      failures.push(`${repoPath} uses a version suffix in an active doc filename.`);
    }
    if (activeFinalNamePattern.test(baseName)) {
      failures.push(`${repoPath} uses \`final\` in an active doc filename.`);
    }
  }
  if (failures.length) fail(failures);
}

async function validateMetadata(markdownFiles) {
  const failures = [];

  for (const filePath of markdownFiles) {
    const repoPath = toRepoPath(filePath);
    if (!isGovernedDoc(repoPath)) continue;

    const source = await fs.readFile(filePath, 'utf8');
    const metadata = parseTopMetadata(source);

    for (const key of requiredMetadataKeys) {
      const value = metadata.get(key);
      if (!value) {
        failures.push(`${repoPath} is missing required metadata: ${key}`);
      }
    }

    const lastValidated = metadata.get('Last validated against code');
    if (lastValidated && !validatedDatePattern.test(lastValidated)) {
      failures.push(`${repoPath} has an invalid Last validated against code date: ${lastValidated}`);
    }

    const status = metadata.get('Status');
    if (status && !allowedStatuses.has(status)) {
      failures.push(`${repoPath} has an invalid Status: ${status}`);
    }

    if (statusSpecificMetadata.has(status)) {
      for (const key of statusSpecificMetadata.get(status)) {
        const value = metadata.get(key);
        if (!value) {
          failures.push(`${repoPath} is missing required metadata for ${status}: ${key}`);
        }
      }
    }

    const pathPolicy = metadata.get('Path policy');
    if (pathPolicy && !allowedPathPolicies.has(pathPolicy)) {
      failures.push(`${repoPath} has an invalid Path policy: ${pathPolicy}`);
    }
  }

  if (failures.length) fail(failures.slice(0, 80));
}

async function validateReferences(markdownFiles) {
  const failures = [];

  for (const filePath of markdownFiles) {
    const repoPath = toRepoPath(filePath);
    if (!isActiveDoc(repoPath)) {
      continue;
    }
    const source = await fs.readFile(filePath, 'utf8');
    // Historical markers inspect the complete source, including fenced examples.
    // Preserve the former top-level checker scope without widening it to specs.
    if (path.posix.dirname(repoPath) === 'docs'
      && !repoPath.startsWith('docs/audit-')
      && !repoPath.startsWith('docs/security-')
      && historicalPathPattern.test(source)
      && !source.includes(requiredHistoricalNote)) {
      failures.push(`${repoPath} references retired path families but is missing the required historical path note.`);
    }
    const strippedSource = source.replace(fencedCodePattern, '');
    const metadata = parseTopMetadata(source);
    const skipInlinePathValidation = shouldSkipInlinePathValidation(repoPath, metadata);

    markdownLinkPattern.lastIndex = 0;
    for (const match of strippedSource.matchAll(markdownLinkPattern)) {
      const token = match[1]?.trim();
      if (!token) continue;
      const resolved = resolveReference(token, filePath);
      if (!resolved) continue;
      try {
        await fs.access(resolved);
      } catch {
        failures.push(`${repoPath} references missing path: ${token}`);
      }
    }

    if (skipInlinePathValidation) {
      continue;
    }

    inlineCodePattern.lastIndex = 0;
    for (const match of strippedSource.matchAll(inlineCodePattern)) {
        const token = match[1]?.trim();
        if (!token) continue;
        const resolved = resolveReference(token, filePath);
        if (!resolved) continue;
        try {
          await fs.access(resolved);
        } catch {
          failures.push(`${repoPath} references missing path: ${token}`);
        }
    }
  }

  if (failures.length) fail(failures.slice(0, 50));
}

async function validateAgentRoutingIndex() {
  const routingPath = path.resolve(rootDir, 'docs/governance/agent-routing-index.md');
  const registryPath = path.resolve(rootDir, 'docs/governance/document-registry.md');
  const governanceReadmePath = path.resolve(rootDir, 'docs/governance/README.md');
  const agentStartPath = path.resolve(rootDir, 'docs/governance/agent-start-here.md');
  const failures = [];

  let routingSource = '';
  try {
    routingSource = await fs.readFile(routingPath, 'utf8');
  } catch {
    failures.push('docs/governance/agent-routing-index.md is missing.');
  }

  if (routingSource) {
    const requiredSnippets = [
      'not a fix location',
      'Signal / symptom',
      'Start here',
      'Confirm owner by',
      'First code entrypoints',
      'Common false starts',
      'Proposed`, `Draft`, and `Hold` documents are context only'
    ];

    for (const snippet of requiredSnippets) {
      if (!routingSource.includes(snippet)) {
        failures.push(`docs/governance/agent-routing-index.md is missing routing guard text: ${snippet}`);
      }
    }

    const prohibitedPhrases = [
      'edit this file',
      'fix here'
    ];

    const lowerRoutingSource = routingSource.toLowerCase();
    for (const phrase of prohibitedPhrases) {
      if (lowerRoutingSource.includes(phrase)) {
        failures.push(`docs/governance/agent-routing-index.md uses prohibited fix-location phrasing: ${phrase}`);
      }
    }
  }

  for (const [filePath, label] of [
    [registryPath, 'docs/governance/document-registry.md'],
    [governanceReadmePath, 'docs/governance/README.md'],
    [agentStartPath, 'docs/governance/agent-start-here.md']
  ]) {
    const source = await fs.readFile(filePath, 'utf8');
    if (!source.includes('agent-routing-index.md')) {
      failures.push(`${label} must reference docs/governance/agent-routing-index.md.`);
    }
  }

  if (failures.length) fail(failures);
}

const main = async () => {
  await validateDocsRoot();

  const markdownFiles = [
    path.resolve(rootDir, 'README.md'),
    path.resolve(rootDir, 'AGENTS.md'),
    ...await walkMarkdownFiles(docsDir),
    ...await walkMarkdownFiles(path.resolve(rootDir, 'src'))
      .then((files) => files.filter((filePath) => path.basename(filePath) === 'README.md'))
  ];

  await validateActiveNames(markdownFiles);
  await validateMetadata(markdownFiles);
  await validateReferences(markdownFiles);
  await validateAgentRoutingIndex();

  console.log('[docs:paths] PASS: active docs use clean names, governed docs carry canonical metadata and status vocabulary, checked references resolve, and top-level historical paths are marked.');
};

main().catch((error) => {
  console.error('[docs:paths] Unexpected error:', error);
  process.exit(1);
});
