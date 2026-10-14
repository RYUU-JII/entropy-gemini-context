import React from 'react';

function requireExternalUrl(value) {
  if (value === '#entropy-landing-store-link-development') {
    return value;
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('LANDING_CHROME_STORE_URL_INVALID');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('LANDING_CHROME_STORE_URL_PROTOCOL_INVALID');
  }
  return parsed.href;
}

export default function LandingInvitation({ copy, chromeStoreUrl }) {
  const storeUrl = requireExternalUrl(chromeStoreUrl);
  return (
    <div className="landing-invitation">
      <a
        className="landing-invitation__cta"
        href={storeUrl}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={copy.ctaLabel}
      >
        <span>{copy.cta}</span>
        <span className="landing-invitation__arrow" aria-hidden="true">↗</span>
      </a>
      <p className="landing-invitation__fact">{copy.localFact}</p>
      <nav className="landing-invitation__links" aria-label="Entropy">
        <a href="./privacy/">{copy.privacy}</a>
        <a href="./support/">{copy.support}</a>
      </nav>
    </div>
  );
}
