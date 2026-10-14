import React from 'react';
import { SITE_CONFIG } from '../app/siteConfig.js';

export default function ContextSidebar() {
  return (
    <aside className="feed-context" aria-label="이 피드에 대하여">
      <section className="feed-context-about">
        <h2>지금 이 피드</h2>
        <p>작품과 짧은 생각, 작은 웹 실험.<br />그리고 멈춰 버린 하늘 계정의 이야기.</p>
      </section>
      <div className="feed-context-foot">
        <p>반응은 현재 페이지에서만 유지됩니다.</p>
        <a href={SITE_CONFIG.privacyUrl}>개인정보 안내</a>
      </div>
    </aside>
  );
}
