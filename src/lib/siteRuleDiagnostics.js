import { normalizeDomain } from '@/lib/domain.js';
import { getSiteAliasHosts } from '@/lib/siteAliasRegistry.js';

function appendDistinctMember(summaryByHost, host, member) {
  const current = summaryByHost.get(host);
  if (!current) {
    summaryByHost.set(host, {
      count: 1,
      soleMember: member,
    });
    return;
  }

  current.count += 1;
  current.soleMember = null;
}

function hasMemberOtherThan(summary, member) {
  return Boolean(summary && (
    summary.count > 1 || summary.soleMember !== member
  ));
}

function visitHostnameSuffixes(hostname, visitor) {
  let suffix = hostname;
  while (suffix) {
    visitor(suffix);
    const separatorIndex = suffix.indexOf('.');
    if (separatorIndex < 0) return;
    suffix = suffix.slice(separatorIndex + 1);
  }
}

export function buildSiteRuleDiagnostics(ruleDomains = []) {
  const normalizedRules = Array.from(
    new Set(
      (Array.isArray(ruleDomains) ? ruleDomains : [])
        .map((domain) => normalizeDomain(domain))
        .filter(Boolean),
    ),
  );

  const candidateHostsByRule = new Map();
  const ruleOwnersByCandidateHost = new Map();
  const matchingRulesByCandidateHost = new Map();

  normalizedRules.forEach((domain) => {
    const aliasHosts = getSiteAliasHosts(domain);
    const candidateHosts = [...new Set([domain, ...aliasHosts])];

    candidateHostsByRule.set(domain, {
      aliasHosts,
      candidateHosts,
    });

    candidateHosts.forEach((candidateHost) => {
      appendDistinctMember(ruleOwnersByCandidateHost, candidateHost, domain);
    });

    visitHostnameSuffixes(domain, (candidateHost) => {
      appendDistinctMember(matchingRulesByCandidateHost, candidateHost, domain);
    });
  });

  return normalizedRules.reduce((diagnosticsByDomain, domain) => {
    const { aliasHosts, candidateHosts } = candidateHostsByRule.get(domain);
    let coversSubdomains = false;
    let coveredByBroaderRule = false;

    for (const candidateHost of candidateHosts) {
      if (hasMemberOtherThan(matchingRulesByCandidateHost.get(candidateHost), domain)) {
        coversSubdomains = true;
        break;
      }
    }

    visitHostnameSuffixes(domain, (candidateHost) => {
      if (coveredByBroaderRule) return;
      coveredByBroaderRule = hasMemberOtherThan(
        ruleOwnersByCandidateHost.get(candidateHost),
        domain,
      );
    });

    diagnosticsByDomain[domain] = {
      coversSubdomains,
      coveredByBroaderRule,
      aliasHosts,
    };
    return diagnosticsByDomain;
  }, {});
}

export function getSiteRuleBadgeItems(domain, diagnosticsByDomain = {}) {
  const normalized = normalizeDomain(domain);
  if (!normalized) return [];

  const diagnostics = diagnosticsByDomain?.[normalized] || null;
  if (!diagnostics) return [];

  const items = [];

  if (diagnostics.coversSubdomains) {
    items.push({
      id: 'covers_subdomains',
      label: 'Covers subdomains',
    });
  }

  if (diagnostics.coveredByBroaderRule) {
    items.push({
      id: 'covered_by_broader_rule',
      label: 'Included by broader rule',
    });
  }

  if (Array.isArray(diagnostics.aliasHosts) && diagnostics.aliasHosts.length > 0) {
    items.push({
      id: 'service_aliases',
      label: `Alias: ${diagnostics.aliasHosts.join(', ')}`,
    });
  }

  return items;
}
