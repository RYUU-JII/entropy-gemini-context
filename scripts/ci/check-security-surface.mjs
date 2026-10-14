#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assertPackagedExtensionWorkerCsp } from '../../src/platform/extension/extensionPageWorkerCspContract.js';
import { inspectRuntimeNetworkSurface } from './runtimeNetworkSurfaceContract.mjs';
import { inspectHtmlInjectionSurface } from './htmlInjectionSurfaceContract.mjs';
import {
  assertCanonicalManifestChromeCompatibility,
} from '../../src/platform/extension/chromeCompatibilityContract.js';
import { STORAGE_LOCAL_KEY_KEYS } from '../../src/platform/storage/internal/chrome-storage/storageKeyRegistry.js';

const rootDir = process.cwd();
const sourceDir = path.resolve(rootDir, 'src');
const manifestPath = path.resolve(rootDir, 'src/manifest.json');
const settingsTabPath = path.resolve(rootDir, 'src/apps/dashboard/tabs/settings/SettingsTab.jsx');
const securitySettingsQueryServicePath = path.resolve(
  rootDir,
  'src/platform/storage/security/SecuritySettingsQueryService.js',
);
const statsPipelineDiagnosticsLabPath = path.resolve(
  rootDir,
  'src/apps/dashboard/tabs/experiment/StatsPipelineDiagnosticsLab.jsx',
);
const artifactCapabilityHookPath = path.resolve(
  rootDir,
  'src/apps/dashboard/hooks/useProtectionArtifactCapabilityState.js',
);
const dashboardPermissionSnapshotResourcePath = path.resolve(
  rootDir,
  'src/apps/dashboard/capabilities/browserPermissionSnapshotResource.js',
);
const cryptoServicePath = path.resolve(rootDir, 'src/platform/security/CryptoService.js');
const faviconFetchPath = path.resolve(rootDir, 'src/platform/browser/faviconFetch.js');
const packagedAssetFetchPath = path.resolve(
  rootDir,
  'src/platform/extension/packagedAssetFetch.js',
);
const htmlInjectionSurfacePath = path.resolve(
  rootDir,
  'docs/operations/security-surface-html-sinks.json',
);
const SETTINGS_TAB_REL_PATH = 'src/apps/dashboard/tabs/settings/SettingsTab.jsx';
const PACKAGED_ASSET_FETCH_REL_PATH = 'src/platform/extension/packagedAssetFetch.js';
const nudgeRenderHostMainPath = path.resolve(rootDir, 'src/apps/nudge-render-host/main.js');
const nudgeRenderHostChannelPath = path.resolve(
  rootDir,
  'src/domains/nudge/runtime/frame-host/NudgeRenderHostChannel.js',
);
const nudgeFrameRuntimePath = path.resolve(
  rootDir,
  'src/domains/nudge/runtime/NudgeExtensionFrameWorkerRuntime.js',
);
const nudgeFrameCapabilityRoutePath = path.resolve(
  rootDir,
  'src/apps/background/services/runtime/messageRoutes/nudgeFrameHostCapabilityMessageRoutes.js',
);

const SCAN_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json']);
const ALL_URLS_LITERAL = '<all_urls>';
const EXPECTED_EXTENSION_PAGE_CSP = "default-src 'self'; script-src 'self'; object-src 'none'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; media-src 'self' blob:; frame-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none';";
const EXPECTED_MANIFEST_PERMISSIONS = Object.freeze([
  'storage',
  'tabs',
  'alarms',
  'favicon',
]);
const EXPECTED_MANIFEST_OPTIONAL_PERMISSIONS = Object.freeze([
  'tabGroups',
  'notifications',
  'scripting',
  'history',
  'bookmarks',
  'idle',
  'webNavigation',
]);
const EXPECTED_MANIFEST_OPTIONAL_HOST_PERMISSIONS = Object.freeze(['*://*/*']);
const EXPECTED_WEB_ACCESSIBLE_RESOURCES = Object.freeze([
  'src/apps/content/*.js',
  'src/pages/nudge-render-host.html',
  'src/pages/room-478.html',
  'assets/*',
  'assets/**/*',
  'chunks/*.js',
  'icons/*.png',
]);
const EXPECTED_WEB_ACCESSIBLE_MATCHES = Object.freeze(['*://*/*']);
const FORBIDDEN_MANIFEST_KEYS = Object.freeze([
  'externally_connectable',
  'host_permissions',
  'oauth2',
]);
const FORBIDDEN_MANIFEST_PERMISSIONS = new Set([
  'cookies',
  'debugger',
  'declarativeNetRequest',
  'declarativeNetRequestFeedback',
  'declarativeNetRequestWithHostAccess',
  'downloads',
  'geolocation',
  'identity',
  'management',
  'nativeMessaging',
  'privacy',
  'proxy',
  'webRequest',
  'webRequestBlocking',
]);
const ALLOWED_WILDCARD_HOST_LITERAL_FILES = new Set(['src/manifest.json']);

const SOURCE_RULES = [
  {
    id: 'google-fonts-api',
    re: /https?:\/\/(?:www\.)?fonts\.googleapis\.com/gi,
    message: 'External Google Fonts API URL is forbidden in runtime source.',
  },
  {
    id: 'google-fonts-static',
    re: /https?:\/\/(?:www\.)?fonts\.gstatic\.com/gi,
    message: 'External Google Fonts static URL is forbidden in runtime source.',
  },
  {
    id: 'jsdelivr-cdn',
    re: /https?:\/\/(?:cdn\.)?jsdelivr\.net/gi,
    message: 'External jsDelivr CDN URL is forbidden in runtime source.',
  },
  {
    id: 'transparent-textures',
    re: /https?:\/\/(?:www\.)?transparenttextures\.com/gi,
    message: 'External texture URL is forbidden in runtime source.',
  },
];

const RUNTIME_NETWORK_EXECUTION_RULES = [
  {
    id: 'fetch',
    re: /\bfetch\s*\(/g,
    allowedFiles: new Set([
      PACKAGED_ASSET_FETCH_REL_PATH,
    ]),
    message: 'Runtime fetch is only allowed in the same-extension packaged asset boundary; content and favicon owners may not fetch remote URLs.',
  },
  {
    id: 'xml-http-request',
    re: /\bXMLHttpRequest\b/g,
    allowedFiles: new Set(),
    message: 'XMLHttpRequest is forbidden in runtime source.',
  },
  {
    id: 'websocket',
    re: /\bWebSocket\s*\(/g,
    allowedFiles: new Set(),
    message: 'WebSocket is forbidden in runtime source.',
  },
  {
    id: 'event-source',
    re: /\bEventSource\s*\(/g,
    allowedFiles: new Set(),
    message: 'EventSource is forbidden in runtime source.',
  },
  {
    id: 'send-beacon',
    re: /\bnavigator\.sendBeacon\s*\(/g,
    allowedFiles: new Set(),
    message: 'sendBeacon is forbidden in runtime source.',
  },
  {
    id: 'import-scripts',
    re: /\bimportScripts\s*\(/g,
    allowedFiles: new Set(),
    message: 'importScripts is forbidden in runtime source.',
  },
  {
    id: 'eval',
    re: /\beval\s*\(/g,
    allowedFiles: new Set(),
    message: 'eval is forbidden in runtime source.',
  },
  {
    id: 'new-function',
    re: /\bnew\s+Function\s*\(/g,
    allowedFiles: new Set(),
    message: 'new Function is forbidden in runtime source.',
  },
];

const RUNTIME_EXTENSION_SURFACE_RULES = [
  {
    id: 'external-message-listener',
    re: /\bchrome\.runtime\.onMessageExternal\b/g,
    message: 'External runtime message listeners are forbidden in active source.',
  },
  {
    id: 'external-connect-listener',
    re: /\bchrome\.runtime\.onConnectExternal\b/g,
    message: 'External runtime connection listeners are forbidden in active source.',
  },
  {
    id: 'native-message-send',
    re: /\bchrome\.runtime\.sendNativeMessage\s*\(/g,
    message: 'Native messaging sends are forbidden in active source.',
  },
  {
    id: 'native-connect',
    re: /\bchrome\.runtime\.connectNative\s*\(/g,
    message: 'Native messaging connections are forbidden in active source.',
  },
  {
    id: 'cookies-api',
    re: /\bchrome\.cookies\b/g,
    message: 'chrome.cookies is forbidden in active source.',
  },
  {
    id: 'web-request-api',
    re: /\bchrome\.webRequest\b/g,
    message: 'chrome.webRequest is forbidden in active source.',
  },
  {
    id: 'declarative-net-request-api',
    re: /\bchrome\.declarativeNetRequest\b/g,
    message: 'chrome.declarativeNetRequest is forbidden in active source.',
  },
  {
    id: 'proxy-api',
    re: /\bchrome\.proxy\b/g,
    message: 'chrome.proxy is forbidden in active source.',
  },
  {
    id: 'debugger-api',
    re: /\bchrome\.debugger\b/g,
    message: 'chrome.debugger is forbidden in active source.',
  },
  {
    id: 'management-api',
    re: /\bchrome\.management\b/g,
    message: 'chrome.management is forbidden in active source.',
  },
];

const FAILURES = [];
const WARNINGS = [];
let manifestCache = null;

const toPosix = (targetPath) => path.relative(rootDir, targetPath).split(path.sep).join('/');

const addFailure = (filePath, line, message, sample = '') => {
  const suffix = sample ? ` [match=${sample}]` : '';
  FAILURES.push(`${toPosix(filePath)}:${line} ${message}${suffix}`);
};

const countMatches = (text, pattern) => {
  const match = String(text || '').match(pattern);
  return Array.isArray(match) ? match.length : 0;
};

const formatList = (value) => JSON.stringify(Array.isArray(value) ? value : value ?? null);

const assertStringArrayExact = (filePath, actual, expected, label) => {
  if (!Array.isArray(actual)) {
    addFailure(filePath, 1, `${label} must be an array.`, `actual=${formatList(actual)}`);
    return;
  }

  const unexpected = actual.filter((entry) => !expected.includes(entry));
  const missing = expected.filter((entry) => !actual.includes(entry));
  const orderMatches = actual.length === expected.length
    && actual.every((entry, index) => entry === expected[index]);
  if (unexpected.length > 0 || missing.length > 0 || !orderMatches) {
    addFailure(
      filePath,
      1,
      `${label} drifted from the reviewed least-privilege contract.`,
      `expected=${formatList(expected)} actual=${formatList(actual)}`,
    );
  }
};

const lineOf = (text, index) => {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
};

const extractCspDirectiveValue = (csp, directiveName) => {
  if (typeof csp !== 'string' || !csp.trim()) return '';
  if (typeof directiveName !== 'string' || !directiveName.trim()) return '';
  const escaped = directiveName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = csp.match(new RegExp(`(?:^|;)\\s*${escaped}\\s+([^;]+)`, 'i'));
  return match?.[1]?.trim() || '';
};

const walkFiles = async (dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const abs = path.resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(abs);
    }
    if (!entry.isFile()) return [];
    return SCAN_EXTENSIONS.has(path.extname(entry.name)) ? [abs] : [];
  }));
  return nested.flat();
};

const scanSourceFiles = async () => {
  const files = await walkFiles(sourceDir);
  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    const relPath = toPosix(filePath);
    if (/^src\/(?:apps\/(?:dashboard|popup|content)\/|themes\/|domains\/behavior\/collectors\/)/u.test(relPath)) {
      const keyConsumer = /\b(?:domainHmacSecret|logCryptoJwk|clseHmacJwk|KEY_MATERIAL_FIELDS|getDomainHmacSecret|getLogCryptoJwk|getClseHmacSecret|requireUnlocked)\b/u.exec(content);
      if (keyConsumer) {
        addFailure(filePath, lineOf(content, keyConsumer.index),
          'UI/content key consumers must use the canonical background owner so vault mutation barriers are shared.',
          keyConsumer[0]);
      }
    }
    for (const rule of SOURCE_RULES) {
      rule.re.lastIndex = 0;
      let match = rule.re.exec(content);
      while (match) {
        const line = lineOf(content, match.index);
        addFailure(filePath, line, rule.message, String(match[0]));
        match = rule.re.exec(content);
      }
    }
  }
};

const scanCryptoWorkerBoundary = async () => {
  let source = '';
  try {
    source = await fs.readFile(cryptoServicePath, 'utf8');
  } catch (error) {
    addFailure(cryptoServicePath, 1, `Failed to load CryptoService guardrail file: ${error?.message || error}`);
    return;
  }

  if (/\bchrome\.runtime\.getURL/u.test(source)) {
    addFailure(
      cryptoServicePath,
      1,
      'CryptoService must resolve extension worker URLs through ChromeService runtimeGetURL().',
    );
  }
};

const scanSecurityVaultBoundary = async () => {
  const registryPath = path.resolve(rootDir, 'src/platform/storage/internal/chrome-storage/storageKeyRegistry.js');
  if (Object.keys(STORAGE_LOCAL_KEY_KEYS).length !== 1
    || STORAGE_LOCAL_KEY_KEYS.SECURITY_VAULT !== 'keys.security_vault') {
    addFailure(registryPath, 1, 'Persistent key storage must expose only the canonical security key record.');
  }

  const contracts = [
    {
      file: 'src/platform/security/vaultCryptography.js',
      required: [
        'VAULT_KDF_ITERATIONS = 600_000',
        'VAULT_MIN_PASSPHRASE_CHARACTERS = 16',
        'VAULT_MAX_PASSPHRASE_BYTES = 128',
        'envelope.kdf.iterations !== VAULT_KDF_ITERATIONS',
        'requireExactKeys(envelope',
        'envelopeAdditionalData(envelope, options.authenticatedContext)',
        'additionalData, tagLength: 128',
        'crypto.subtle.encrypt(',
        'crypto.subtle.decrypt(',
        'tagLength: 128',
        'SECURITY_ENVELOPE_SIZE_LIMIT',
      ],
    },
    {
      file: 'src/platform/storage/internal/chrome-storage/stores/KeyStore.js',
      required: [
        'requireSecurityKeyRecord(envelope)',
        'writeChromeStorageLocal({ [STORAGE_LOCAL_KEY_KEYS.SECURITY_VAULT]: envelope })',
        'retiredKeysPresent:',
      ],
      forbidden: /\b(?:getLogCryptoJwk|setLogCryptoJwk|getDomainHmacSecret|setDomainHmacSecret|getClseHmacSecret|setClseHmacSecret|writeEntries)\s*\(/u,
    },
    {
      file: 'src/platform/storage/security/securityKeyRecordContract.js',
      required: [
        "LOCAL_SECURITY_KEYRING_FORMAT = 'entropy-local-keyring'",
        "['format', 'version', 'id', 'keyring']",
        'record.version !== 1',
        'decodeBase64Url(record.id, { exactBytes: 16 })',
        'requireCanonicalSecurityKeyring(record.keyring)',
        'requireEncryptedEnvelope(record',
        "['format', 'version', 'id', 'protectionKeys', 'envelope']",
        "['version', 'domainHmacSecret', 'clseHmacJwk']",
        "['version', 'logCryptoJwk']",
        'SECURITY_LOG_KEY_VAULT_ID_MISMATCH',
      ],
    },
    {
      file: 'src/platform/storage/security/KeyMaterialRepository.js',
      required: [
        'await initializeTrustedLocalStorageAccess()',
        'await initializeTrustedSessionStorageAccess()',
        'SECURITY_VAULT_PLAINTEXT_PROFILE_UNSUPPORTED',
        'SECURITY_VAULT_SESSION_MISMATCH',
        'session.envelopeDigest !== await envelopeDigest(envelope)',
        'this.sessionStore.set({ vaultId: envelope.id, envelopeDigest: await envelopeDigest(envelope), keyring })',
        'this.invalidateKeyCaches()',
        'if (barrier === this.mutationTail) return state',
        'async #readState()',
        'invalidate: false',
        'SECURITY_VAULT_PASSPHRASE_CHANGED_SESSION_COMMIT_FAILED',
        'SECURITY_VAULT_PASSPHRASE_CHANGED_SESSION_CLEAR_FAILED',
        'ensureLocalVault()',
        "if (state.status.state !== 'setup_required') return state.status",
        'requireSecurityKeyRecord(persistent.envelope)',
        'removeVaultPassphrase({ currentPassphrase }',
        'restorePassphrase === undefined ? localKeyRecord(canonical)',
        'requireSecurityVaultStatus(',
        'authenticatedContext: logVaultContext(record)',
        'onProtectionKeysInvalidated(listener)',
        'async requireProtectionKeys()',
        'separateVaultProtectionKeys({ passphrase }',
        "state.envelope?.format !== SECURITY_VAULT_FORMAT",
      ],
      forbidden: /\b(?:writeChromeStorageLocal|writeChromeStorageSession)\s*\(/u,
    },
    {
      file: 'src/platform/security/securityVaultStatusContract.js',
      required: [
        "['state', 'version', 'mode', 'lockScope', 'protectionReady']",
        'SECURITY_VAULT_STATUS_INVALID',
        "value.lockScope === 'logs' && value.protectionReady === true",
        "value.lockScope === 'profile' && value.protectionReady === (value.state === 'unlocked')",
      ],
    },
    {
      file: 'src/domains/behavior/utils/hmacKey.js',
      required: ['onProtectionKeysInvalidated(', 'requireProtectionKeys('],
      forbidden: /\b(?:onLock|requireUnlocked)\s*\(/u,
    },
    {
      file: 'src/platform/security/CryptoService.js',
      required: ['keyMaterialRepository.onLock(', 'false, [\'encrypt\', \'decrypt\']'],
      forbidden: /\b(?:generateKey|exportKey|setLogCryptoJwk)\s*\(/u,
    },
    {
      file: 'src/platform/workers/crypto.worker.js',
      required: ['payload.key.extractable !== false', "payload.key.algorithm?.name !== 'AES-GCM'"],
      forbidden: /\b(?:importKey|exportKey|generateKey)\s*\(/u,
    },
    {
      file: 'src/platform/storage/internal/storageSnapshotService.js',
      required: [
        'encryptSecurityEnvelope(',
        'decryptSecurityEnvelope(',
        'const preparedImports = new WeakMap()',
        'prepareRestoredVault(',
        'installRestoredVault(',
      ],
      forbidden: /\b(?:includeSecrets|importSecrets|migrateNotificationsConfigV1|migrateProgressionState)\b/u,
    },
  ];
  const results = await Promise.allSettled(contracts.map(async (contract) => ({
    contract,
    filePath: path.resolve(rootDir, contract.file),
    source: await fs.readFile(path.resolve(rootDir, contract.file), 'utf8'),
  })));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      addFailure(path.resolve(rootDir, contracts[index].file), 1,
        `Failed to load security vault owner: ${result.reason?.message || result.reason}`);
      return;
    }
    const { contract, filePath, source } = result.value;
    contract.required.forEach((token) => {
      if (!source.includes(token)) {
        addFailure(filePath, 1, `Security vault owner must retain contract ${token}.`);
      }
    });
    const forbidden = contract.forbidden?.exec(source);
    if (forbidden) {
      addFailure(filePath, lineOf(source, forbidden.index),
        'Security vault owner contains a retired or unauthorized key operation.', forbidden[0]);
    }
  });
};

const scanRuntimeNetworkExecutionBoundaries = async () => {
  const sourceFiles = await walkFiles(sourceDir);
  for (const filePath of sourceFiles) {
    const content = await fs.readFile(filePath, 'utf8');
    const relPath = toPosix(filePath);
    if (/\.[cm]?[jt]sx?$/u.test(relPath)) {
      for (const failure of inspectRuntimeNetworkSurface({ file: relPath, source: content })) {
        addFailure(filePath, failure.line, failure.message);
      }
    }
    for (const rule of RUNTIME_NETWORK_EXECUTION_RULES) {
      rule.re.lastIndex = 0;
      let match = rule.re.exec(content);
      while (match) {
        if (!rule.allowedFiles.has(relPath)) {
          addFailure(filePath, lineOf(content, match.index), rule.message, String(match[0]));
        }
        match = rule.re.exec(content);
      }
    }
  }

  let faviconSource = '';
  try {
    faviconSource = await fs.readFile(faviconFetchPath, 'utf8');
  } catch (error) {
    addFailure(faviconFetchPath, 1, `Failed to load favicon fetch boundary file: ${error?.message || error}`);
    return;
  }

  const faviconFetchCount = countMatches(faviconSource, /\bfetch\s*\(/g);
  if (faviconFetchCount !== 0) {
    addFailure(faviconFetchPath, 1, 'Favicon capture cannot own any direct fetch call.', `count=${faviconFetchCount}`);
  }
  const faviconCompact = faviconSource.replace(/\s+/g, ' ');
  const requiredFragments = [
    ['local-origin-owner', 'fetchPackagedExtensionAsset(assetUrl, { runtimeUrl, signal: controller.signal })'],
    ['browser-cache-only', 'runtimeGetURL(`_favicon/?pageUrl=${encodeURIComponent(page.href)}&size=64`)'],
    ['timeout', 'new AbortController()'],
    ['binary-budget', 'MAX_FAVICON_BINARY_BYTES'],
    ['data-url-budget', 'MAX_FAVICON_DATA_URL_CHARS'],
    ['data-url-validator', 'isAllowedFaviconDataUrl'],
    ['png-signature', 'PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)'],
    ['png-header', "header.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR'"],
    ['dimension-budget', 'MAX_LOCAL_FAVICON_DIMENSION = 256'],
    ['dimension-admission', '!width || !height || width > MAX_LOCAL_FAVICON_DIMENSION || height > MAX_LOCAL_FAVICON_DIMENSION'],
    ['png-decoder', "createImageBitmap(new Blob([bytes], { type: 'image/png' }))"],
    ['decoded-dimensions', 'bitmap.width !== width || bitmap.height !== height'],
    ['decoder-cleanup', 'finally { bitmap.close(); }'],
    ['canonical-png-mime', 'data:image/png;base64,${btoa(binary)}'],
  ];
  requiredFragments.forEach(([id, fragment]) => {
    if (!faviconCompact.includes(fragment)) {
      addFailure(faviconFetchPath, 1, `Local favicon cache boundary is missing required guardrail: ${id}.`);
    }
  });
  if (/allowCrossOrigin|fetch\s*\(\s*(?:candidate|faviconUrl|pageUrl)/u.test(faviconSource)) {
    addFailure(faviconFetchPath, 1, 'Favicon observations cannot become network destinations.');
  }
  const faviconViewPath = path.resolve(rootDir, 'src/ui-kit/Favicon.jsx');
  const faviconView = await fs.readFile(faviconViewPath, 'utf8');
  if (!faviconView.includes('.filter(isAllowedFaviconDataUrl)')) {
    addFailure(faviconViewPath, 1, 'Injected favicon presentation candidates must be bounded local data URLs.');
  }
  const gatePath = path.resolve(rootDir, 'src/apps/gate/GateInterstitialApp.jsx');
  const gateSource = await fs.readFile(gatePath, 'utf8');
  if (/sourceCandidates=\{[^\n]*favIconUrl/u.test(gateSource)) {
    addFailure(gatePath, 1, 'Gate cannot pass a remote tab favicon URL to image presentation.');
  }

  let packagedAssetSource = '';
  try {
    packagedAssetSource = await fs.readFile(packagedAssetFetchPath, 'utf8');
  } catch (error) {
    addFailure(
      packagedAssetFetchPath,
      1,
      `Failed to load packaged asset fetch boundary file: ${error?.message || error}`,
    );
    return;
  }
  const packagedAssetFetchCount = countMatches(packagedAssetSource, /\bfetch\s*\(/g);
  if (packagedAssetFetchCount !== 1) {
    addFailure(
      packagedAssetFetchPath,
      1,
      'Packaged asset fetch boundary must own exactly one reviewed fetch call.',
      `count=${packagedAssetFetchCount}`,
    );
  }
  const packagedAssetCompact = packagedAssetSource.replace(/\s+/g, ' ');
  [
    ['extension-protocols', 'PACKAGED_EXTENSION_PROTOCOLS'],
    ['same-protocol', 'asset.protocol !== runtime.protocol'],
    ['same-host', 'asset.host !== runtime.host'],
    ['same-origin-credentials', "credentials: 'same-origin'"],
    ['cache', "cache !== 'force-cache' && cache !== 'no-store'"],
    ['redirect', "redirect: 'error'"],
  ].forEach(([id, fragment]) => {
    if (!packagedAssetCompact.includes(fragment)) {
      addFailure(
        packagedAssetFetchPath,
        1,
        `Packaged asset fetch boundary is missing required guardrail: ${id}.`,
      );
    }
  });
};

const scanHtmlInjectionSurface = async () => {
  let contract;
  try {
    contract = JSON.parse(await fs.readFile(htmlInjectionSurfacePath, 'utf8'));
  } catch (error) {
    addFailure(
      htmlInjectionSurfacePath,
      1,
      `Failed to load HTML injection surface contract: ${error?.message || error}`,
    );
    return;
  }
  const sources = new Map();
  for (const filePath of await walkFiles(sourceDir)) {
    if (!['.js', '.jsx', '.ts', '.tsx'].includes(path.extname(filePath))) continue;
    sources.set(toPosix(filePath), await fs.readFile(filePath, 'utf8'));
  }
  for (const failure of inspectHtmlInjectionSurface({ contract, sources })) {
    addFailure(path.resolve(rootDir, failure.path), failure.line, failure.message, failure.detail);
  }
};

const scanForbiddenExtensionApiSurfaces = async () => {
  const sourceFiles = await walkFiles(sourceDir);
  for (const filePath of sourceFiles) {
    const content = await fs.readFile(filePath, 'utf8');
    for (const rule of RUNTIME_EXTENSION_SURFACE_RULES) {
      rule.re.lastIndex = 0;
      let match = rule.re.exec(content);
      while (match) {
        addFailure(filePath, lineOf(content, match.index), rule.message, String(match[0]));
        match = rule.re.exec(content);
      }
    }
  }
};

const scanManifestPolicy = async () => {
  let manifest;
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    manifest = JSON.parse(raw);
    manifestCache = manifest;
  } catch (error) {
    addFailure(manifestPath, 1, `Failed to read or parse manifest: ${error?.message || error}`);
    return;
  }

  if (manifest?.manifest_version !== 3) {
    addFailure(
      manifestPath,
      1,
      'Manifest must remain MV3.',
      `manifest_version=${manifest?.manifest_version}`,
    );
  }

  try {
    assertCanonicalManifestChromeCompatibility(manifest, {
      source: 'src/manifest.json',
    });
  } catch (error) {
    addFailure(
      manifestPath,
      1,
      'Manifest minimum_chrome_version must match the reviewed runtime and rendered-artifact capability floor.',
      error?.message || String(error),
    );
  }

  FORBIDDEN_MANIFEST_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(manifest || {}, key)) {
      addFailure(
        manifestPath,
        1,
        `Manifest key "${key}" is outside the reviewed extension security surface.`,
      );
    }
  });

  assertStringArrayExact(
    manifestPath,
    manifest?.permissions,
    EXPECTED_MANIFEST_PERMISSIONS,
    'Manifest permissions',
  );
  assertStringArrayExact(
    manifestPath,
    manifest?.optional_permissions,
    EXPECTED_MANIFEST_OPTIONAL_PERMISSIONS,
    'Manifest optional permissions',
  );
  assertStringArrayExact(
    manifestPath,
    manifest?.optional_host_permissions,
    EXPECTED_MANIFEST_OPTIONAL_HOST_PERMISSIONS,
    'Manifest optional host permissions',
  );
  const webAccessibleRules = manifest?.web_accessible_resources;
  if (!Array.isArray(webAccessibleRules) || webAccessibleRules.length !== 1) {
    addFailure(
      manifestPath,
      1,
      'Manifest must retain exactly one reviewed web_accessible_resources rule.',
      `actual=${formatList(webAccessibleRules)}`,
    );
  } else {
    const [webAccessibleRule] = webAccessibleRules;
    const unexpectedKeys = Object.keys(webAccessibleRule || {})
      .filter((key) => !['matches', 'resources'].includes(key));
    if (unexpectedKeys.length > 0) {
      addFailure(
        manifestPath,
        1,
        'Manifest web_accessible_resources rule contains an unreviewed field.',
        unexpectedKeys.join(','),
      );
    }
    assertStringArrayExact(
      manifestPath,
      webAccessibleRule?.resources,
      EXPECTED_WEB_ACCESSIBLE_RESOURCES,
      'Manifest web-accessible resources',
    );
    assertStringArrayExact(
      manifestPath,
      webAccessibleRule?.matches,
      EXPECTED_WEB_ACCESSIBLE_MATCHES,
      'Manifest web-accessible matches',
    );
  }

  [
    ...(Array.isArray(manifest?.permissions) ? manifest.permissions : []),
    ...(Array.isArray(manifest?.optional_permissions) ? manifest.optional_permissions : []),
  ].forEach((permission) => {
    if (FORBIDDEN_MANIFEST_PERMISSIONS.has(permission)) {
      addFailure(
        manifestPath,
        1,
        `Permission "${permission}" is forbidden by the extension security surface contract.`,
      );
    }
  });

  const csp = String(manifest?.content_security_policy?.extension_pages || '');
  if (!csp.trim()) {
    addFailure(manifestPath, 1, 'Missing extension_pages CSP.');
  }
  if (csp !== EXPECTED_EXTENSION_PAGE_CSP) {
    addFailure(
      manifestPath,
      1,
      'extension_pages CSP drifted from the reviewed network/execution contract.',
      `expected=${EXPECTED_EXTENSION_PAGE_CSP} actual=${csp}`,
    );
  }

  try {
    assertPackagedExtensionWorkerCsp(csp, { source: 'src/manifest.json' });
  } catch (error) {
    addFailure(manifestPath, 1, error.message);
  }

  const connectSrcValue = extractCspDirectiveValue(csp, 'connect-src');
  if (connectSrcValue !== "'self'") {
    addFailure(
      manifestPath,
      1,
      "CSP connect-src must permit the extension origin only.",
      `connect-src ${connectSrcValue}`,
    );
  }

};

const scanSelectiveHostGuardrails = async () => {
  let settingsTabSource = '';
  let statsPipelineDiagnosticsLabSource = '';
  let artifactCapabilityHookSource = '';
  let dashboardPermissionSnapshotResourceSource = '';
  try {
    settingsTabSource = await fs.readFile(settingsTabPath, 'utf8');
    statsPipelineDiagnosticsLabSource = await fs.readFile(statsPipelineDiagnosticsLabPath, 'utf8');
    artifactCapabilityHookSource = await fs.readFile(artifactCapabilityHookPath, 'utf8');
    dashboardPermissionSnapshotResourceSource = await fs.readFile(
      dashboardPermissionSnapshotResourcePath,
      'utf8',
    );
  } catch (error) {
    addFailure(manifestPath, 1, `Failed to load required guardrail files: ${error?.message || error}`);
    return;
  }

  const requestPattern = /permissionsRequest\s*\(\s*\{\s*origins\s*:\s*\[\s*['"]<all_urls>['"]\s*\]\s*\}\s*\)/g;
  const wildcardRequestPattern = /permissionsRequest\s*\(\s*\{\s*origins\s*:\s*\[\s*['"]\*:\/\/\*\/\*['"]\s*\]\s*\}\s*\)/g;
  const removePattern = /permissionsRemove(?:Strict)?\s*\(\s*\{\s*origins\s*:\s*\[\s*['"]<all_urls>['"]\s*\]\s*\}\s*\)/g;
  const wildcardRemovePattern = /permissionsRemove(?:Strict)?\s*\(\s*\{\s*origins\s*:\s*\[\s*['"]\*:\/\/\*\/\*['"]\s*\]\s*\}\s*\)/g;

  const strictPermissionSnapshotReaders = [
    {
      filePath: dashboardPermissionSnapshotResourcePath,
      source: dashboardPermissionSnapshotResourceSource,
      owner: 'Dashboard permission snapshot resource',
      strictMessage:
        'Dashboard permission snapshot resource must use permissionsGetAllStrict() so malformed permission snapshots surface visibly.',
    },
    {
      filePath: statsPipelineDiagnosticsLabPath,
      source: statsPipelineDiagnosticsLabSource,
      owner: 'Stats pipeline diagnostics',
      strictMessage:
        'Stats pipeline diagnostics must use permissionsGetAllStrict() so malformed permission snapshots stay diagnostic evidence.',
    },
  ];

  for (const reader of strictPermissionSnapshotReaders) {
    if (!reader.source.includes('permissionsGetAllStrict')) {
      addFailure(reader.filePath, 1, reader.strictMessage);
    }
    if (
      /\bpermissionsGetAll\s*\(/u.test(reader.source)
      || /\bpermissionsGetAll\s*,/u.test(reader.source)
    ) {
      addFailure(
        reader.filePath,
        1,
        `${reader.owner} must not use loose permissionsGetAll().`,
      );
    }
  }

  for (const consumer of [
    { filePath: settingsTabPath, source: settingsTabSource, owner: 'Settings permission state refresh' },
    { filePath: artifactCapabilityHookPath, source: artifactCapabilityHookSource, owner: 'Artifact capability state' },
  ]) {
    if (!consumer.source.includes('readDashboardPermissionSnapshot')) {
      addFailure(
        consumer.filePath,
        1,
        `${consumer.owner} must use the shared strict dashboard permission snapshot resource.`,
      );
    }
    if (consumer.source.includes('permissionsGetAllStrict')) {
      addFailure(
        consumer.filePath,
        1,
        `${consumer.owner} must not bypass the shared dashboard permission snapshot resource.`,
      );
    }
  }

  const sourceFiles = await walkFiles(sourceDir);
  for (const filePath of sourceFiles) {
    const content = await fs.readFile(filePath, 'utf8');
    const relPath = toPosix(filePath);

    const literalIndex = content.indexOf(ALL_URLS_LITERAL);
    if (literalIndex >= 0) {
      addFailure(
        filePath,
        lineOf(content, literalIndex),
        "Release V1 selective-only runtime must not contain '<all_urls>' detection, request, or revoke paths.",
      );
    }

    const wildcardLiteralIndex = content.indexOf('*://*/*');
    if (wildcardLiteralIndex >= 0 && !ALLOWED_WILDCARD_HOST_LITERAL_FILES.has(relPath)) {
      addFailure(
        filePath,
        lineOf(content, wildcardLiteralIndex),
        "Runtime wildcard host literals are forbidden; only the manifest declaration may advertise the selectable host ceiling.",
      );
    }

    const globalHostOwnerPattern = /\b(?:revokeGlobalHostPermissions|hasGlobalHostPermissionOrigin|hasGlobalHostPermission|hasGlobalAccess|globalHostPermission)\b/gu;
    const globalHostOwnerCount = countMatches(content, globalHostOwnerPattern);
    if (globalHostOwnerCount > 0) {
      addFailure(
        filePath,
        1,
        'Release V1 host permission state is selective-only; global host permission owners and derived state are forbidden.',
        `count=${globalHostOwnerCount}`,
      );
    }

    const requestCount = countMatches(content, requestPattern);
    const wildcardRequestCount = countMatches(content, wildcardRequestPattern);
    const removeCount = countMatches(content, removePattern);
    const wildcardRemoveCount = countMatches(content, wildcardRemovePattern);
    if (requestCount > 0) {
      addFailure(
        filePath,
        1,
        "Requesting '<all_urls>' is forbidden in active runtime code.",
        `count=${requestCount}`,
      );
    }
    if (wildcardRequestCount > 0) {
      addFailure(
        filePath,
        1,
        "Requesting '*://*/*' as a runtime wildcard host grant is forbidden; request concrete site origins instead.",
        `count=${wildcardRequestCount}`,
      );
    }
    if (removeCount > 0) {
      addFailure(
        filePath,
        1,
        "Removing '<all_urls>' is forbidden because release V1 has no legacy global grant contract.",
        `count=${removeCount}`,
      );
    }
    if (wildcardRemoveCount > 0) {
      addFailure(
        filePath,
        1,
        "Removing '*://*/*' as a global grant is forbidden because runtime never requests or owns that grant.",
        `count=${wildcardRemoveCount}`,
      );
    }
  }
};

const scanSecuritySettingsGuardrails = async () => {
  let source = '';
  try {
    source = await fs.readFile(securitySettingsQueryServicePath, 'utf8');
  } catch (error) {
    addFailure(
      securitySettingsQueryServicePath,
      1,
      `Failed to load security settings query service: ${error?.message || error}`,
    );
    return;
  }

  [
    'SECURITY_SETTINGS_SNAPSHOT_INVALID',
    'normalizeSecuritySettingsSnapshot',
    'readSecurityBoolean',
    'readSecurityString',
    'throw createSecuritySettingsSnapshotError',
  ].forEach((token) => {
    if (!source.includes(token)) {
      addFailure(
        securitySettingsQueryServicePath,
        1,
        `Security settings query boundary must keep strict snapshot validation token ${token}.`,
      );
    }
  });

  [
    'resolved[RESET_GUARD_KEY] !== false',
    'resolved[HIGH_SECURITY_MODE_KEY] === true',
    '? resolved[MASTER_PASSCODE_KEY]',
  ].forEach((token) => {
    if (source.includes(token)) {
      addFailure(
        securitySettingsQueryServicePath,
        1,
        `Security settings query boundary must not coerce malformed stored values through token ${token}.`,
      );
    }
  });
};

const scanSettingsPermissionActionSurface = async () => {
  let source = '';
  try {
    source = await fs.readFile(settingsTabPath, 'utf8');
  } catch (error) {
    addFailure(settingsTabPath, 1, `Failed to load Settings tab permission action surface: ${error?.message || error}`);
    return;
  }

  [
    'SETTINGS_USAGE_POLICY_SAVE_FAILED',
    'SETTINGS_HOST_PERMISSION_GRANT_FAILED',
  ].forEach((token) => {
    if (!source.includes(token)) {
      addFailure(
        settingsTabPath,
        1,
        `Settings permission action failures must remain visible in PermissionGate status: missing ${token}.`,
      );
    }
  });

  // Recording restoration owns pending/retry/error feedback in the exclusion
  // disclosure; the parent propagates the canonical command failure to it.
  const permissionGatePath = path.resolve(rootDir, 'src/apps/dashboard/tabs/settings/components/PermissionGate.jsx');
  const permissionGateSource = await fs.readFile(permissionGatePath, 'utf8');
  for (const token of [
    'SETTINGS_TRACKING_DOMAIN_RESTORE_FAILED',
    'catch (failure)',
    'setError(',
    '<SettingsFeedback message={error}',
  ]) {
    if (!permissionGateSource.includes(token)) {
      addFailure(permissionGatePath, 1, `Recording restoration must keep retryable visible failure feedback: missing ${token}.`);
    }
  }

  [
    'setPermissionStatus(describeSettingsActionError(error,',
    'statusMessage={permissionStatus}',
    'onUsagePolicyChange={handleUsagePolicyChange}',
    'buildLocalUsagePolicyPatch(selection)',
    'localUsagePolicyRequiresPrecisionPermission(patch)',
    'onRestoreTrackedDomain={handleRestoreTrackedDomain}',
    'const grantManagedSiteAccess = useCallback(async () => {',
    'if (!managedDomains.length) return;',
    'ensureOriginEnforcementPermissionsStrict(',
    'missingManagedSiteAccess.origins',
    'onGrantManagedSiteAccess={grantManagedSiteAccess}',
    'managedSiteCount={managedDomains.length}',
    'missingSiteCount={missingManagedSiteAccess.siteCount}',
    'precisionInsightsSignals={resolvedPrecisionInsightsSignals}',
  ].forEach((token) => {
    if (!source.includes(token)) {
      addFailure(
        settingsTabPath,
        1,
        `Settings permission action surface must keep the visible status/render contract token ${token}.`,
      );
    }
  });

  [
    'ensureScriptingPermissionStrict',
    'onGrant={requestGrant}',
    'onGrantMissingOrigins={grantMissingOrigins}',
  ].forEach((token) => {
    if (source.includes(token)) {
      addFailure(
        settingsTabPath,
        1,
        `Settings permission action surface must not restore the standalone scripting pre-grant token ${token}.`,
      );
    }
  });

  [
    'SETTINGS_GLOBAL_HOST_REVOKE_FAILED',
    'onRevokeGlobalOrigins',
    'reduceGlobalHostAccess',
    'revokeGlobalHostPermissions',
  ].forEach((token) => {
    if (source.includes(token)) {
      addFailure(
        settingsTabPath,
        1,
        `Settings permission action surface must remain selective-only and omit retired global-host token ${token}.`,
      );
    }
  });
};

const scanNudgeRenderHostChannelBoundary = async () => {
  const sources = new Map();
  for (const filePath of [
    nudgeRenderHostMainPath,
    nudgeRenderHostChannelPath,
    nudgeFrameRuntimePath,
    nudgeFrameCapabilityRoutePath,
  ]) {
    try {
      sources.set(filePath, await fs.readFile(filePath, 'utf8'));
    } catch (error) {
      addFailure(filePath, 1, `Failed to load nudge frame-host security owner: ${error?.message || error}`);
    }
  }
  if (sources.size !== 4) return;

  const mainSource = sources.get(nudgeRenderHostMainPath);
  const channelSource = sources.get(nudgeRenderHostChannelPath);
  const runtimeSource = sources.get(nudgeFrameRuntimePath);
  const routeSource = sources.get(nudgeFrameCapabilityRoutePath);

  [
    'installAuthenticatedNudgeRenderHostChannel',
    "channelProtocol: 'message_port_v1'",
  ].forEach((token) => {
    if (!mainSource.includes(token)) {
      addFailure(
        nudgeRenderHostMainPath,
        1,
        `Public nudge render host must retain authenticated channel token ${token}.`,
      );
    }
  });
  if (mainSource.includes("globalThis.addEventListener('message'")) {
    addFailure(
      nudgeRenderHostMainPath,
      1,
      'Public nudge render host must not restore a direct window command listener; bootstrap belongs to the authenticated channel owner.',
    );
  }

  [
    'event?.source !== parentRef',
    'event?.ports?.[0]',
    'consumeCapability({',
    'message.command !== NUDGE_EXTENSION_FRAME_WORKER_PROBE.START',
    'message.command === NUDGE_EXTENSION_FRAME_WORKER_PROBE.START) return',
    "protocol: 'message_port_v1'",
  ].forEach((token) => {
    if (!channelSource.includes(token)) {
      addFailure(
        nudgeRenderHostChannelPath,
        1,
        `Public nudge render-host bootstrap/data-plane separation is missing token ${token}.`,
      );
    }
  });

  [
    'issueNudgeFrameHostCapability',
    'capability: this.capabilityTicket.capability',
    '[channel.port2]',
    'this.hostPort.postMessage',
  ].forEach((token) => {
    if (!runtimeSource.includes(token)) {
      addFailure(
        nudgeFrameRuntimePath,
        1,
        `Nudge extension-frame runtime must retain capability-bound MessagePort token ${token}.`,
      );
    }
  });

  [
    'isTrustedExtensionTabSender',
    'isTrustedExtensionPageSender',
    "const RENDER_HOST_PATH = '/src/pages/nudge-render-host.html'",
    "senderUrl.searchParams.get('session') === sessionId",
    'senderFrameId <= 0',
  ].forEach((token) => {
    if (!routeSource.includes(token)) {
      addFailure(
        nudgeFrameCapabilityRoutePath,
        1,
        `Nudge frame-host capability route must retain exact sender binding token ${token}.`,
      );
    }
  });
};

const main = async () => {
  await scanManifestPolicy();
  await scanSelectiveHostGuardrails();
  await scanSecuritySettingsGuardrails();
  await scanSettingsPermissionActionSurface();
  await scanNudgeRenderHostChannelBoundary();
  await scanSourceFiles();
  await scanCryptoWorkerBoundary();
  await scanSecurityVaultBoundary();
  await scanRuntimeNetworkExecutionBoundaries();
  await scanHtmlInjectionSurface();
  await scanForbiddenExtensionApiSurfaces();

  if (FAILURES.length > 0) {
    FAILURES.forEach((entry) => {
      console.error(`[security-surface] FAIL ${entry}`);
    });
  }

  WARNINGS.forEach((entry) => {
    console.warn(`[security-surface] WARN ${entry}`);
  });

  if (FAILURES.length > 0) {
    process.exit(1);
    return;
  }

  console.log('[security-surface] PASS: network, CSP, HTML sink inventory, extension API, manifest, and selective-only host permission contracts are satisfied.');
};

main().catch((error) => {
  console.error('[security-surface] Unexpected error:', error);
  process.exit(1);
});
