import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Collect repository-relative paths in root and filesystem traversal order.
 * Each checker owns its extensions and exclusions. As in the theme guards,
 * directory symlinks are not traversed; matching non-directory entries remain
 * candidates, so a missing or unreadable source still fails at its read owner.
 */
export async function collectRepositoryFiles({
  rootDir,
  roots,
  extensions,
  excludedEntryNames = new Set(),
}) {
  const files = [];
  async function walk(relativeDir) {
    const directory = path.resolve(rootDir, relativeDir);
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (excludedEntryNames.has(entry.name)) continue;
      const relativePath = path.relative(rootDir, path.join(directory, entry.name))
        .replaceAll(path.sep, '/');
      if (entry.isDirectory()) {
        await walk(relativePath);
      } else if (extensions.has(path.extname(entry.name))) {
        files.push(relativePath);
      }
    }
  }
  for (const root of roots) await walk(root);
  return files;
}

// Preserve the guards' existing lexical vocabulary, including test/tool imports.
// This is a shared scan primitive, not a JavaScript parser or safety proof.
export function extractImportSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /vi\.mock\(\s*['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return [...new Set(specifiers)];
}
