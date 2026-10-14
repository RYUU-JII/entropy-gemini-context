export function normalizeDomain(raw) {
  const base = String(raw || '').trim().toLowerCase();
  if (!base) return '';

  let value = base
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0];

  if (!value) return '';

  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end !== -1) return value.slice(1, end).replace(/\.+$/g, '');
    return value;
  }

  const colonIndex = value.indexOf(':');
  if (colonIndex !== -1) value = value.slice(0, colonIndex);
  return value.replace(/\.+$/g, '');
}

export function isHostnameMatch(hostname, domain) {
  const target = normalizeDomain(hostname);
  const base = normalizeDomain(domain);
  if (!target || !base) return false;
  return target === base || target.endsWith(`.${base}`);
}

export function isHostnameInList(hostname, list) {
  if (!hostname || !Array.isArray(list) || list.length === 0) return false;
  return list.some((entry) => isHostnameMatch(hostname, entry));
}

const MULTI_PART_TLDS = new Set([
  'co.kr', 'ne.kr', 'or.kr', 're.kr', 'pe.kr', 'go.kr', 'ac.kr',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'com.br', 'net.br', 'org.br',
  'com.co', 'net.co', 'org.co',
  'com.tw', 'org.tw', 'idv.tw',
  'com.hk', 'org.hk', 'edu.hk',
  'com.sg', 'org.sg', 'edu.sg',
  'com.my', 'org.my', 'net.my',
  'co.nz', 'net.nz', 'org.nz',
  'co.za', 'org.za', 'net.za',
]);

export function extractBaseDomainParts(rawDomain) {
  const normalized = normalizeDomain(rawDomain);
  if (!normalized) return { subdomain: '', baseLabel: '', tld: '' };

  const parts = normalized.split('.');
  if (parts.length === 1) {
    return { subdomain: '', baseLabel: parts[0], tld: '' };
  }

  let tldPartsCount = 1;
  if (parts.length >= 3) {
    const twoPartTld = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (MULTI_PART_TLDS.has(twoPartTld)) {
      tldPartsCount = 2;
    }
  }

  const baseLabelIndex = parts.length - 1 - tldPartsCount;
  if (baseLabelIndex < 0) {
    return { subdomain: '', baseLabel: parts[0], tld: parts.slice(1).join('.') };
  }

  const baseLabel = parts[baseLabelIndex];
  const tld = parts.slice(baseLabelIndex + 1).join('.');
  const subdomain = parts.slice(0, baseLabelIndex).join('.');

  return { subdomain, baseLabel, tld };
}

export function extractBaseDomainLabel(rawDomain) {
  return extractBaseDomainParts(rawDomain).baseLabel;
}

export function isSameBaseDomainMatch(hostname, ruleDomain) {
  const normHost = normalizeDomain(hostname);
  const normRule = normalizeDomain(ruleDomain);
  if (!normHost || !normRule) return false;

  if (isHostnameMatch(normHost, normRule)) return true;

  const ruleParts = extractBaseDomainParts(normRule);
  const hostParts = extractBaseDomainParts(normHost);

  if (!ruleParts.baseLabel || ruleParts.baseLabel.length < 3) return false;
  if (ruleParts.baseLabel !== hostParts.baseLabel) return false;

  if (!ruleParts.subdomain) {
    return true;
  }

  return ruleParts.subdomain === hostParts.subdomain;
}

