import React from 'react';
import Modal from '../ui/Modal.jsx';
import Icon, { EntropyMark } from '../ui/Icon.jsx';
import { INSTALL_LINK } from './siteConfig.js';

export default function InformationDialog({ kind, onClose }) {
  const product = kind === 'product';
  return (
    <Modal
      title={product ? 'Entropy, 주의에 선택의 여지를.' : '이 피드에 대하여'}
      onClose={onClose}
    >
      <div className="feed-info-mark"><EntropyMark size={48} /></div>
      <p className="feed-info-lead">
        {product ? '자동으로 이어지던 웹의 흐름에, 내가 정한 간격을.' : '작품과 짧은 생각, 작은 웹 실험, 그리고 한 편의 연재.'}
      </p>

      {product ? (
        <>
          <p>Entropy는 Chrome 브라우저 확장입니다. 보호할 사이트와 시간을 정하고, 시각 필터와 진입 확인, 클릭·스크롤 저항, 개입 알림을 조율할 수 있습니다.</p>
          <div className="feed-info-points">
            <div>
              <span>01</span>
              <p>
                <strong>내가 정하는 경계</strong>
                대상 사이트, 스케줄과 보호 강도를 직접 설정합니다.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>나에게 맞는 세계</strong>
                Zen을 비롯한 여섯 테마로 개입과 피드백을 경험합니다.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>기기 안의 기록</strong>
                허용한 범위의 사용 기록으로 자신의 패턴을 돌아봅니다.
              </p>
            </div>
          </div>
          <a
            className="feed-button feed-button-primary"
            href={INSTALL_LINK.href}
            target="_blank"
            rel="noreferrer"
          >
            {INSTALL_LINK.label}
            <Icon name="external" size={15} />
          </a>
          <p className="feed-session-notice">설정과 사용 기록, 분석 결과는 기기에서 처리·보관되며 외부로 자동 전송되지 않습니다.</p>
          <p className="feed-session-notice">확장의 냉각 곡선은 사이트별 시간 목표에 따라 켠 효과를 점차 강화합니다. 이 체험의 피드 끝 Horizon은 웹사이트 연출입니다.</p>
        </>
      ) : (
        <>
          <p>몇 개의 계정이 올린 작품과 글을 모은 피드입니다. 이미지를 넘겨보거나, 손잡이와 버튼으로 장면을 바꿔볼 수 있습니다.</p>
          <div className="feed-info-points">
            <div>
              <span>01</span>
              <p>
                <strong>직접 만든 콘텐츠</strong>
                이미지와 영상, 연재 이야기와 그 등장 계정은 이 페이지를 위해 만든 오리지널입니다.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>이 페이지에서의 반응</strong>
                좋아요와 댓글은 실제로 누르고 남긴 반응만 표시합니다.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>가입 없이 둘러보기</strong>
                계정이나 로그인 없이 게시물을 보고 공유할 수 있습니다.
              </p>
            </div>
          </div>
          <p className="feed-session-notice">좋아요·댓글은 현재 페이지의 메모리에만 남습니다. 서버로 전송하거나 새로고침 뒤 보관하지 않습니다.</p>
        </>
      )}
    </Modal>
  );
}
