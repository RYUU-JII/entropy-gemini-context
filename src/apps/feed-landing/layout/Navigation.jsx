import React from 'react';
import Icon, { EntropyMark } from '../ui/Icon.jsx';
import { SITE_CONFIG } from '../app/siteConfig.js';

export default function Navigation({ view, onNavigate, onProduct, onSupport }) {
  return (
    <aside className="feed-navigation">
      <a className="feed-brand" href="#feed" aria-label="Entropy 피드 처음으로" onClick={(event) => { event.preventDefault(); onNavigate('feed'); }}>
        <EntropyMark size={35} /><span>entropy<span className="feed-brand-dot">.</span></span>
      </a>
      <nav className="feed-nav-links" aria-label="주요 탐색">
        <button type="button" className={view === 'feed' ? 'is-active' : ''} aria-current={view === 'feed' ? 'page' : undefined} onClick={() => onNavigate('feed')}>
          <Icon name="home" /><span>피드</span><span className="feed-nav-active-dot" />
        </button>
        <button type="button" className={view === 'shortform' ? 'is-active' : ''} aria-current={view === 'shortform' ? 'page' : undefined} onClick={() => onNavigate('shortform')}>
          <Icon name="shortform" /><span>숏폼</span><span className="feed-nav-active-dot" />
        </button>
      </nav>
      <div className="feed-nav-project">
        <button type="button" onClick={onProduct}><Icon name="info" size={18} /><span>Entropy 소개</span></button>
        <a href={SITE_CONFIG.sourceUrl} target="_blank" rel="noreferrer"><Icon name="github" size={18} /><span>GitHub</span><Icon name="external" size={13} /></a>
        <button type="button" onClick={onSupport}><Icon name="support" size={18} /><span>후원 안내</span></button>
      </div>
      <div className="feed-nav-bottom">
        <button className="feed-button feed-button-primary feed-install-button" type="button" onClick={onProduct}><span>확장 프로그램 보기</span><Icon name="arrow" size={18} /></button>
        <div className="feed-nav-legal"><a href={SITE_CONFIG.privacyUrl}>개인정보 안내</a><span>·</span><a href={SITE_CONFIG.supportUrl} target="_blank" rel="noreferrer">문의</a></div>
      </div>
    </aside>
  );
}
