import { normalizeDomain } from './domain.js';

// URL parameters carry an uncommitted UI choice. They are not a permission
// queue, a storage owner, or authority to register a site.
export function buildSiteRegistrationIntent({ domain = '', ...other } = {}) {
  if (Object.keys(other).length) throw new Error('SITE_REGISTRATION_INTENT_FIELD_INVALID');
  if (typeof domain !== 'string') throw new Error('SITE_REGISTRATION_INTENT_DOMAIN_INVALID');
  let normalized = '';
  if (domain) {
    normalized = normalizeDomain(domain);
    if (!normalized) throw new Error('SITE_REGISTRATION_INTENT_DOMAIN_INVALID');
  }
  return Object.freeze({ domain: normalized });
}

export function buildSiteRegistrationPath(input = {}) {
  const intent = buildSiteRegistrationIntent(input);
  const params = new URLSearchParams({ tab: 'main', setup: 'site-registration' });
  if (intent.domain) params.set('domain', intent.domain);
  return `src/pages/dashboard.html?${params}`;
}

export function readSiteRegistrationIntent(search) {
  const params = new URLSearchParams(search);
  if (params.get('setup') !== 'site-registration') return null;
  // Old links may carry a time choice. Registration no longer admits it;
  // canonicalize this input to the site alone without applying that value.
  const rawDomain = params.get('domain');
  return buildSiteRegistrationIntent({ domain: rawDomain === null ? '' : rawDomain });
}
