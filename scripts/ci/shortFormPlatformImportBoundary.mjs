import path from 'node:path';

const SHORT_FORM_PLATFORM_ROOT = 'src/domains/nudge/short-form/platforms';
const SHORT_FORM_PLATFORM_IMPORT_OWNER =
  'src/domains/nudge/short-form/shortFormTargetResolver.js';

function normalizeProjectPath(value) {
  return String(value || '').replaceAll('\\', '/');
}

export function collectLiteralModuleSpecifiers(source) {
  if (typeof source !== 'string') return Object.freeze([]);
  const specifiers = [];
  const declarationPattern = /^\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gmu;
  const dynamicPattern = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu;

  for (const match of source.matchAll(declarationPattern)) specifiers.push(match[1]);
  for (const match of source.matchAll(dynamicPattern)) specifiers.push(match[1]);
  return Object.freeze(Array.from(new Set(specifiers)));
}

export function resolveActiveSourceImport(importerPath, specifier) {
  const normalizedImporter = normalizeProjectPath(importerPath);
  const normalizedSpecifier = normalizeProjectPath(specifier).split(/[?#]/u, 1)[0];
  if (!normalizedImporter || !normalizedSpecifier) return null;

  if (normalizedSpecifier.startsWith('.')) {
    return path.posix.normalize(path.posix.join(
      path.posix.dirname(normalizedImporter),
      normalizedSpecifier,
    ));
  }
  if (normalizedSpecifier.startsWith('@/')) {
    return path.posix.normalize(`src/${normalizedSpecifier.slice(2)}`);
  }
  if (normalizedSpecifier.startsWith('/src/')) {
    return path.posix.normalize(normalizedSpecifier.slice(1));
  }
  if (normalizedSpecifier.startsWith('src/')) {
    return path.posix.normalize(normalizedSpecifier);
  }
  return null;
}

function isShortFormPlatformTarget(resolvedPath) {
  return resolvedPath === SHORT_FORM_PLATFORM_ROOT
    || resolvedPath.startsWith(`${SHORT_FORM_PLATFORM_ROOT}/`);
}

export function findShortFormPlatformImportBoundaryViolations(sourceEntries = []) {
  const violations = [];
  for (const entry of sourceEntries) {
    const importerPath = normalizeProjectPath(entry?.relativePath);
    if (!importerPath || importerPath === SHORT_FORM_PLATFORM_IMPORT_OWNER) continue;
    for (const specifier of collectLiteralModuleSpecifiers(entry?.source)) {
      const resolvedPath = resolveActiveSourceImport(importerPath, specifier);
      if (!resolvedPath || !isShortFormPlatformTarget(resolvedPath)) continue;
      violations.push(Object.freeze({
        importerPath,
        specifier,
        resolvedPath,
      }));
    }
  }
  return Object.freeze(violations);
}

export const SHORT_FORM_PLATFORM_IMPORT_BOUNDARY = Object.freeze({
  owner: SHORT_FORM_PLATFORM_IMPORT_OWNER,
  targetRoot: SHORT_FORM_PLATFORM_ROOT,
});
