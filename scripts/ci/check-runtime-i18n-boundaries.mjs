import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const GOVERNED_DISCOVERY_ROOTS = [
  'src/domains/behavior',
  'src/domains/notifications',
  'src/apps/dashboard/hooks',
  'src/apps/dashboard/tabs/schedule',
  'src/apps/dashboard/tabs/schedule/components',
  'src/apps/dashboard/utils',
  'src/domains/nudge',
  'src/ui-kit',
];

const EXPLICIT_GOVERNED_FILES = [
  'src/apps/popup/main.jsx',
  'src/domains/settings/i18n/nudgeCopy.js',
];
const BACKGROUND_RUNTIME_I18N_FILES = new Set([
  'src/domains/notifications/background/notificationCopyResolver.js',
  'src/domains/settings/i18n/nudgeCopy.js',
]);

const DISCOVERY_EXTENSIONS = new Set(['.js', '.mjs', '.jsx']);
const I18N_RUNTIME_CONSUMER_PATTERN = /(\btBackgroundRuntimeWithLanguage\(|\btBackgroundRuntime\(|\btRuntimeWithLanguage\(|\btRuntime\(|i18n\.t\()/;

const forbiddenTokens = [
  'i18n.t(',
  'useTranslation(',
  'useThemeTranslation(',
  'useAppTranslation(',
];

const standaloneTranslateCall = /(^|[^\w.])translate\(/m;
const violations = [];

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function walkFiles(relativeDir, visit) {
  const absoluteDir = path.join(ROOT, relativeDir);
  for (const name of fs.readdirSync(absoluteDir)) {
    const absolutePath = path.join(absoluteDir, name);
    const relativePath = path.relative(ROOT, absolutePath).replaceAll(path.sep, '/');
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      walkFiles(relativePath, visit);
      continue;
    }
    if (!DISCOVERY_EXTENSIONS.has(path.extname(name))) continue;
    visit(relativePath);
  }
}

function discoverGovernedFiles() {
  const discovered = new Set(EXPLICIT_GOVERNED_FILES);

  for (const root of GOVERNED_DISCOVERY_ROOTS) {
    walkFiles(root, (relativePath) => {
      if (relativePath === 'src/domains/settings/i18n/runtime.js') return;
      const text = readFile(relativePath);
      if (I18N_RUNTIME_CONSUMER_PATTERN.test(text)) {
        discovered.add(relativePath);
      }
    });
  }

  return [...discovered]
    .filter((relativePath) => relativePath !== 'src/domains/settings/i18n/runtime.js')
    .sort()
    .map((relativePath) => ({
      path: relativePath,
      requireOneOf:
        BACKGROUND_RUNTIME_I18N_FILES.has(relativePath)
          ? ['tBackgroundRuntimeWithLanguage(', 'tBackgroundRuntime(']
          : ['tRuntime('],
      allowTranslateWrapper: relativePath === 'src/domains/settings/i18n/nudgeCopy.js',
    }));
}

const governedFiles = discoverGovernedFiles();

function getLineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

function findCallsOverArity(text, functionName, maxAllowedArgs) {
  const violationsForFunction = [];
  const needle = `${functionName}(`;
  let searchStart = 0;

  while (searchStart < text.length) {
    const start = text.indexOf(needle, searchStart);
    if (start === -1) break;

    const prev = start > 0 ? text[start - 1] : '';
    if (/[A-Za-z0-9_$./]/.test(prev)) {
      searchStart = start + needle.length;
      continue;
    }

    let depth = 1;
    let braceDepth = 0;
    let bracketDepth = 0;
    let commaCount = 0;
    let index = start + needle.length;
    let stringQuote = null;
    let escaped = false;

    while (index < text.length && depth > 0) {
      const char = text[index];

      if (stringQuote) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === stringQuote) {
          stringQuote = null;
        }
        index += 1;
        continue;
      }

      if (char === '\'' || char === '"' || char === '`') {
        stringQuote = char;
        index += 1;
        continue;
      }

      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
      } else if (char === '{') {
        braceDepth += 1;
      } else if (char === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
      } else if (char === '[') {
        bracketDepth += 1;
      } else if (char === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
      } else if (char === ',' && depth === 1 && braceDepth === 0 && bracketDepth === 0) {
        commaCount += 1;
      }

      index += 1;
    }

    const argCount = commaCount + 1;
    if (argCount > maxAllowedArgs) {
      violationsForFunction.push(getLineNumber(text, start));
    }

    searchStart = start + needle.length;
  }

  return violationsForFunction;
}

for (const rule of governedFiles) {
  const text = readFile(rule.path);

  for (const token of forbiddenTokens) {
    if (text.includes(token)) {
      violations.push(`${rule.path}: forbidden runtime i18n token "${token}"`);
    }
  }

  if (
    !rule.allowTranslateWrapper &&
    standaloneTranslateCall.test(text)
  ) {
    violations.push(
      `${rule.path}: standalone translate(...) wrapper is not allowed outside src/domains/settings/i18n/nudgeCopy.js`,
    );
  }

  if (
    Array.isArray(rule.requireOneOf) &&
    !rule.requireOneOf.some((token) => text.includes(token))
  ) {
    violations.push(
      `${rule.path}: expected one of ${rule.requireOneOf.join(', ')} in governed runtime surface`,
    );
  }

  for (const [functionName, maxAllowedArgs] of [
    ['tRuntime', 2],
    ['tRuntimeWithLanguage', 3],
    ['tBackgroundRuntime', 2],
    ['tBackgroundRuntimeWithLanguage', 3],
    ['translate', 2],
  ]) {
    const fallbackLines = findCallsOverArity(text, functionName, maxAllowedArgs);
    for (const line of fallbackLines) {
      violations.push(
        `${rule.path}:${line}: ${functionName}(...) fallback argument is not allowed in governed runtime surfaces`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error('[runtime-i18n-boundaries] Contract violation detected:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(
  `[runtime-i18n-boundaries] PASS: validated ${governedFiles.length} runtime/non-React i18n surfaces.`,
);
