import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  I18N_NAMESPACES,
  I18N_SUPPORTED_LOCALES,
} from '../../src/i18n/metadata.js';
import {
  BACKGROUND_LOCALE_PROJECTION,
  projectBackgroundLocaleResources,
  removeBackgroundProjectionFromNamespace,
} from './background-locale-projection.mjs';

const ROOT_DIR = process.cwd();
const LOCALES_DIR = path.join(ROOT_DIR, 'src', 'i18n', 'locales');
const BACKGROUND_RUNTIME_MODULE_NAME = 'backgroundRuntime.js';
const BACKGROUND_RESOURCES_MODULE_PATH = path.join(
  ROOT_DIR,
  'src',
  'i18n',
  'backgroundResources.js',
);

const requireSafeLocaleIds = (supportedLocales) => {
  if (!Array.isArray(supportedLocales) || supportedLocales.length === 0) {
    throw new Error('I18N_SUPPORTED_LOCALES must be a non-empty array.');
  }
  const localeIds = supportedLocales.map((locale, index) => {
    if (
      typeof locale !== 'string'
      || locale.length === 0
      || locale.includes('/')
      || locale.includes('\\')
      || locale.includes('\0')
      || locale === '.'
      || locale === '..'
    ) {
      throw new Error(`I18N_SUPPORTED_LOCALES[${index}] is not a safe locale id.`);
    }
    return locale;
  });
  if (new Set(localeIds).size !== localeIds.length) {
    throw new Error('I18N_SUPPORTED_LOCALES must not contain duplicates.');
  }
  return localeIds;
};

export const createBackgroundResourcesModuleContent = (
  supportedLocales = I18N_SUPPORTED_LOCALES,
) => {
  const localeIds = requireSafeLocaleIds(supportedLocales);
  const records = localeIds.map((locale, index) => ({
    locale,
    binding: `backgroundLocale${index}`,
  }));
  return [
    ...records.map(({ locale, binding }) => (
      `import ${binding} from './locales/${locale}/${BACKGROUND_RUNTIME_MODULE_NAME}';`
    )),
    '',
    'export const BACKGROUND_I18N_RESOURCES = Object.freeze({',
    ...records.map(({ locale, binding }) => (
      `  ${JSON.stringify(locale)}: Object.freeze(${binding}),`
    )),
    '});',
    '',
  ].join('\n');
};

const toModuleContent = (rawJson) => {
  const trimmed = String(rawJson || '').trim();
  JSON.parse(trimmed);
  return `export default ${trimmed};\n`;
};

async function generateLocaleModule(jsonFilePath) {
  const rawJson = await fs.readFile(jsonFilePath, 'utf8');
  const moduleContent = toModuleContent(rawJson);
  const moduleFilePath = jsonFilePath.replace(/\.json$/i, '.js');
  await fs.writeFile(moduleFilePath, moduleContent, 'utf8');
  return moduleFilePath;
}

const toComposedNamespaceModuleContent = ({ namespace, namespaceResource }) => {
  const remaining = removeBackgroundProjectionFromNamespace(namespace, namespaceResource);
  const projectedRoots = (BACKGROUND_LOCALE_PROJECTION[namespace] || [])
    .map((path) => path.split('.')[0]);
  const uniqueRoots = [...new Set(projectedRoots)];
  const rootAssignments = uniqueRoots.map((root) => (
    `resource[${JSON.stringify(root)}] = {\n`
    + `  ...backgroundRuntimeResource[${JSON.stringify(namespace)}][${JSON.stringify(root)}],\n`
    + `  ...resource[${JSON.stringify(root)}],\n`
    + '};'
  ));
  return [
    `import backgroundRuntimeResource from './${BACKGROUND_RUNTIME_MODULE_NAME}';`,
    '',
    `const resource = ${JSON.stringify(remaining, null, 2)};`,
    ...rootAssignments,
    '',
    'export default resource;',
    '',
  ].join('\n');
};

async function writeGeneratedModule(moduleFilePath, moduleContent) {
  await fs.writeFile(moduleFilePath, moduleContent, 'utf8');
  return moduleFilePath;
}

async function readLocaleResources(locale) {
  const resources = {};
  for (const namespace of I18N_NAMESPACES) {
    const jsonPath = path.join(LOCALES_DIR, locale, `${namespace}.json`);
    const rawJson = await fs.readFile(jsonPath, 'utf8');
    resources[namespace] = JSON.parse(rawJson);
  }
  return resources;
}

async function main() {
  const generated = [];

  for (const locale of I18N_SUPPORTED_LOCALES) {
    const resources = await readLocaleResources(locale);
    const backgroundRuntimeResource = projectBackgroundLocaleResources(resources);
    const backgroundModulePath = path.join(
      LOCALES_DIR,
      locale,
      BACKGROUND_RUNTIME_MODULE_NAME,
    );
    await writeGeneratedModule(
      backgroundModulePath,
      `export default ${JSON.stringify(backgroundRuntimeResource, null, 2)};\n`,
    );
    generated.push(backgroundModulePath);

    for (const namespace of I18N_NAMESPACES) {
      const jsonPath = path.join(LOCALES_DIR, locale, `${namespace}.json`);
      const modulePath = Object.prototype.hasOwnProperty.call(
        BACKGROUND_LOCALE_PROJECTION,
        namespace,
      )
        ? await writeGeneratedModule(
          jsonPath.replace(/\.json$/i, '.js'),
          toComposedNamespaceModuleContent({
            namespace,
            namespaceResource: resources[namespace],
          }),
        )
        : await generateLocaleModule(jsonPath);
      generated.push(modulePath);
    }
  }

  await writeGeneratedModule(
    BACKGROUND_RESOURCES_MODULE_PATH,
    createBackgroundResourcesModuleContent(),
  );
  generated.push(BACKGROUND_RESOURCES_MODULE_PATH);

  console.log(`[i18n] Generated locale modules: ${generated.length}`);
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error('[i18n] Failed to generate locale modules.', error);
    process.exitCode = 1;
  });
}
