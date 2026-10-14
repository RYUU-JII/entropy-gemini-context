import React, { useState } from 'react';
import Icon from '../ui/Icon.jsx';
import { INSTALL_LINK, SITE_CONFIG } from '../app/siteConfig.js';

/**
 * Below the feed's end, the page stops being a feed: what happened, where it
 * applies, and one action. The final feed Horizon is disclosed as a website presentation.
 */
const STAGE_EFFECTS = new Set(['desaturation', 'signal', 'blur', 'shuffle']);

export default function FeedAfterword({ afterword, friction, comparison, comparisonLead, onProduct, onRestart }) {
  if (!React.isValidElement(comparison)) throw new Error('FEED_AFTERWORD_COMPARISON_REQUIRED');
  if (typeof comparisonLead !== 'string' || comparisonLead.length === 0) throw new Error('FEED_AFTERWORD_LEAD_REQUIRED');
  afterword.stages.forEach((stage) => { if (!STAGE_EFFECTS.has(stage.effect)) throw new Error(`FEED_AFTERWORD_STAGE_UNKNOWN:${stage.effect}`); });
  // Reduced motion never shuffles text, so that stage is not claimed.
  const stages = afterword.stages.filter((stage) => stage.effect !== 'shuffle' || friction.shuffle > 0);
  const [original, setOriginal] = useState(false);
  return (
    <section className="feed-afterword" id="feed-afterword" aria-labelledby="feed-afterword-title">
      <span className="feed-eyebrow">여기서부터는 피드가 아닙니다</span>
      <h2 id="feed-afterword-title">{afterword.title}</h2>
      <p className="feed-afterword-lead">{afterword.lead}</p>
      <ol className="feed-afterword-stages">
        {stages.map((stage) => <li key={stage.effect}><strong>{stage.title}</strong>{stage.where}</li>)}
      </ol>
      <div
        className="feed-comparison"
        style={{ '--post-desaturation': original ? 0 : friction.desaturation, '--post-blur': `${original ? 0 : friction.blurPx}px` }}
      >
        <div className="feed-media-filter">{comparison}</div>
        <span className="feed-comparison-label">{original ? '원본' : '지나온 표현'}</span>
      </div>
      <p className="feed-afterword-caption">{comparisonLead}</p>
      <button type="button" className="feed-button feed-compare-button" aria-pressed={original} onClick={() => setOriginal(!original)}>
        <Icon name="eye" size={17} />{original ? '지나온 표현 보기' : '원본과 비교하기'}
      </button>

      <div className="feed-invitation">
        <span className="feed-eyebrow">ENTROPY</span>
        <h3>끝없는 피드에, 끝을.</h3>
        <p>Entropy는 Chrome 확장입니다. 직접 고른 사이트와 시간에<br />색과 신호를 누그러뜨리고, 넘기는 수고를 더하고, 피드에 끝을 둡니다.</p>
        <ul className="feed-invitation-uses" aria-label="적용 예">
          <li>숏폼</li><li>무한 스크롤 피드</li><li>자동 재생 추천</li>
        </ul>
        <div className="feed-invitation-actions">
          <a className="feed-button feed-button-primary" href={INSTALL_LINK.href} target="_blank" rel="noreferrer">
            {INSTALL_LINK.label} <Icon name="external" size={15} />
          </a>
          <button type="button" className="feed-button" onClick={onProduct}>Entropy 알아보기</button>
        </div>
        <p className="feed-local-promise">설정과 사용 기록, 분석 결과는 기기에서 처리·보관되며 외부로 자동 전송되지 않습니다.</p>
      </div>
      <p className="feed-afterword-note">확장은 사이트별 시간 목표에 따라 켠 효과를 점차 강화합니다. 이 페이지의 피드 끝 Horizon은 웹사이트 연출이며, 확장은 안전한 경계에서 Furin으로 목표 도달을 알립니다.</p>
      <footer className="feed-end-links">
        <a href={SITE_CONFIG.sourceUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
        <a href={SITE_CONFIG.privacyUrl}>개인정보 안내</a>
        <a href="#" onClick={(event) => { event.preventDefault(); onRestart(); }}>처음으로 ↑</a>
      </footer>
    </section>
  );
}
