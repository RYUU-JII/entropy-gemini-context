import { isHostnameMatch, normalizeDomain } from './domain.js';
import { getSiteAliasHosts } from './siteAliasRegistry.js';

function buildHostnameChain(hostname) {
  const normalized = normalizeDomain(hostname);
  if (!normalized) return [];

  const parts = normalized.split('.');
  const chain = [];
  for (let index = 0; index < parts.length; index += 1) {
    chain.push(parts.slice(index).join('.'));
  }
  return chain;
}

export function buildSiteRuleHostCandidates(ruleHost) {
  const normalized = normalizeDomain(ruleHost);
  if (!normalized) return [];

  const candidates = new Set([normalized]);
  getSiteAliasHosts(normalized).forEach((aliasHost) => {
    candidates.add(aliasHost);
  });
  return Array.from(candidates);
}

export function buildObservedSiteHostCandidates(hostname) {
  const chain = buildHostnameChain(hostname);
  if (!chain.length) return [];

  const candidates = new Set(chain);
  chain.forEach((host) => {
    getSiteAliasHosts(host).forEach((aliasHost) => {
      candidates.add(aliasHost);
    });
  });
  return Array.from(candidates);
}

export function isSiteRuleMatch(hostname, ruleHost) {
  const normalizedHostname = normalizeDomain(hostname);
  if (!normalizedHostname) return false;

  return buildSiteRuleHostCandidates(ruleHost).some((candidate) => (
    isHostnameMatch(normalizedHostname, candidate)
  ));
}

export function isHostnameInSiteList(hostname, list) {
  if (!hostname || !Array.isArray(list) || list.length === 0) return false;
  return list.some((entry) => isSiteRuleMatch(hostname, entry));
}

export function findRedundantSiteRules(ruleHosts = []) {
  const normalizedRules = Array.from(
    new Set(
      (Array.isArray(ruleHosts) ? ruleHosts : [])
        .map((entry) => normalizeDomain(entry))
        .filter(Boolean),
    ),
  );

  return normalizedRules.filter((ruleHost) => normalizedRules.some((otherRuleHost) => (
    otherRuleHost !== ruleHost && isSiteRuleMatch(ruleHost, otherRuleHost)
  )));
}

