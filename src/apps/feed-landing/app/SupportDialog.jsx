import React from 'react';
import Modal from '../ui/Modal.jsx';
import Icon from '../ui/Icon.jsx';
import { SITE_CONFIG } from './siteConfig.js';

export default function SupportDialog({ onClose }) {
  return (
    <Modal title="Entropy 후원 안내" onClose={onClose}>
      <p className="feed-info-lead">프로젝트의 다음을 함께.</p>
      <p>후원 창구를 준비하고 있습니다. 지금은 프로젝트의 소스와 개발 과정을 살펴보거나 의견을 남길 수 있습니다.</p>
      <div className="feed-share-buttons">
        <a className="feed-button" href={SITE_CONFIG.sourceUrl} target="_blank" rel="noreferrer">GitHub <Icon name="external" size={14} /></a>
        <a className="feed-button" href={SITE_CONFIG.supportUrl} target="_blank" rel="noreferrer">의견 남기기 <Icon name="external" size={14} /></a>
      </div>
    </Modal>
  );
}
