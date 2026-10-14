import { isIP } from 'node:net';

export const LANDING_SUPPORT_URL_TOKEN = '__ENTROPY_LANDING_SUPPORT_URL__';
export const LANDING_DEV_SUPPORT_URL = '#entropy-landing-support-contact-development';

const PLACEHOLDER_PATTERN = /(?:example|placeholder|replace[-_ ]?me|change[-_ ]?me|your[-_ ]?(?:email|support|url)|\b(?:todo|tbd)\b)/iu;
const EMAIL_ADDRESS_PATTERN = /^[^\s@/?#]+@[^\s@/?#]+\.[^\s@/?#]+$/u;
const FORBIDDEN_SUPPORT_HOSTS = new Set([
  'chrome.google.com',
  'chromewebstore.google.com',
  'github.com',
  'www.github.com',
]);
const PRIVATE_HOST_SUFFIXES = Object.freeze([
  '.example',
  '.internal',
  '.invalid',
  '.local',
  '.localhost',
  '.test',
]);

function fail(detail) {
  throw new Error(`[landing-build] VITE_SUPPORT_URL ${detail}`);
}

function isPrivateIpv4(hostname) {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }

  const [first, second] = octets;
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || first >= 224;
}

function isPrivateHostname(hostname) {
  const normalized = hostname
    .toLowerCase()
    .replace(/^\[|\]$/gu, '')
    .replace(/\.$/u, '');
  if (
    normalized === 'localhost'
    || PRIVATE_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  ) {
    return true;
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4(normalized);
  if (ipVersion === 6) {
    return normalized === '::1'
      || normalized === '::'
      || /^f[cd]/iu.test(normalized)
      || /^fe[89ab]/iu.test(normalized);
  }
  return false;
}

function assertMailtoSupportUrl(supportUrl) {
  if (supportUrl.search || supportUrl.hash) {
    fail('mailto contact must contain one plain monitored mailbox without query or fragment data.');
  }

  let mailbox;
  try {
    mailbox = decodeURIComponent(supportUrl.pathname);
  } catch {
    fail('mailto contact contains invalid encoding.');
  }

  if (!EMAIL_ADDRESS_PATTERN.test(mailbox)) {
    fail('mailto contact must contain one syntactically valid monitored mailbox.');
  }

  const domain = mailbox.slice(mailbox.lastIndexOf('@') + 1).toLowerCase();
  if (PLACEHOLDER_PATTERN.test(mailbox) || isPrivateHostname(domain)) {
    fail('must not use a placeholder or private mailbox.');
  }

  return `mailto:${mailbox}`;
}

function assertHttpsSupportUrl(supportUrl) {
  const hostname = supportUrl.hostname.toLowerCase().replace(/\.$/u, '');
  if (supportUrl.protocol !== 'https:' || !hostname) {
    fail('must be an HTTPS public support route or a monitored mailto contact.');
  }

  if (isPrivateHostname(hostname)) {
    fail('HTTPS contact must not target a local, private, or reserved host.');
  }

  if (supportUrl.username || supportUrl.password || supportUrl.port) {
    fail('HTTPS contact must not contain credentials or a custom port.');
  }

  if (FORBIDDEN_SUPPORT_HOSTS.has(hostname)) {
    const reason = hostname.endsWith('github.com')
      ? 'must not assume that a GitHub repository is publicly reachable.'
      : 'must not point back to the Chrome Web Store listing.';
    fail(reason);
  }

  return supportUrl.href;
}

export function assertProductionSupportUrl(value) {
  const candidate = String(value ?? '').trim();
  if (!candidate) {
    fail('is required for a production landing build.');
  }
  if (PLACEHOLDER_PATTERN.test(candidate) || candidate === LANDING_DEV_SUPPORT_URL) {
    fail('must not contain a placeholder value.');
  }

  let supportUrl;
  try {
    supportUrl = new URL(candidate);
  } catch {
    fail('must be an absolute HTTPS URL or mailto contact.');
  }

  if (supportUrl.protocol === 'mailto:') {
    return assertMailtoSupportUrl(supportUrl);
  }
  return assertHttpsSupportUrl(supportUrl);
}

export function resolveLandingSupportUrl({ command, environment }) {
  const configuredUrl = environment.VITE_SUPPORT_URL?.trim();
  if (command === 'build') {
    return assertProductionSupportUrl(configuredUrl);
  }
  return configuredUrl ? assertProductionSupportUrl(configuredUrl) : LANDING_DEV_SUPPORT_URL;
}

function escapeHtmlAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function injectLandingSupportUrl(html, supportUrl) {
  const source = String(html);
  const tokenCount = source.split(LANDING_SUPPORT_URL_TOKEN).length - 1;
  if (tokenCount !== 2) {
    throw new Error(
      `[landing-build] Support page must expose exactly one English and one Korean contact link; found ${tokenCount}.`,
    );
  }
  return source.replaceAll(LANDING_SUPPORT_URL_TOKEN, escapeHtmlAttribute(supportUrl));
}
