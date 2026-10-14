import { parse } from '@babel/parser';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const app = resolve(root, 'src/apps/feed-landing');
const allowedPackages = new Set(['react', 'react-dom/client', '@fontsource-variable/noto-sans-kr/wght.css']);
const forbiddenGlobals = new Set(['chrome', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'SharedWorker']);
const failures = [];
let checked = 0;

function assertImport(file, specifier) {
  if (specifier.startsWith('.')) {
    const destination = resolve(dirname(file), specifier);
    if (!destination.startsWith(`${app}${sep}`)) failures.push(`${relative(root, file)}: import leaves feed app: ${specifier}`);
  } else if (!allowedPackages.has(specifier)) failures.push(`${relative(root, file)}: undeclared package: ${specifier}`);
}

async function inspect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, item.name);
    if (item.isDirectory()) { await inspect(file); continue; }
    const extension = extname(file);
    if (!['.js', '.jsx', '.css'].includes(extension)) continue;
    checked += 1;
    const source = await readFile(file, 'utf8');
    if (extension === '.css') {
      for (const match of source.matchAll(/@import\s+['"]([^'"]+)['"]/g)) assertImport(file, match[1]);
      if (/url\(\s*['"]?https?:/i.test(source)) failures.push(`${relative(root, file)}: remote CSS asset`);
      continue;
    }
    const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) assertImport(file, node.source.value);
      if (node.type === 'ImportExpression' || (node.type === 'CallExpression' && node.callee?.type === 'Import')) failures.push(`${relative(root, file)}: dynamic imports need an explicit closure contract`);
      if (node.type === 'Identifier' && forbiddenGlobals.has(node.name)) failures.push(`${relative(root, file)}: forbidden runtime/storage/network owner ${node.name}`);
      for (const [key, value] of Object.entries(node)) {
        if (['loc', 'start', 'end', 'extra'].includes(key)) continue;
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') visit(value);
      }
    };
    visit(ast.program);
  }
}

await inspect(app);
if (failures.length) { console.error([...new Set(failures)].join('\n')); process.exitCode = 1; }
else console.log(`[feed-landing-boundary] PASS: ${checked} files; isolated imports, session-only state, no network or extension runtime.`);
