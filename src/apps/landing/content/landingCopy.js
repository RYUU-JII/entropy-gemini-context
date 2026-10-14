export const LANDING_LOCALES = Object.freeze({
  KO: 'ko',
  EN: 'en',
});

const COPY = Object.freeze({
  ko: Object.freeze({
    localeName: '한국어',
    documentTitle: 'Entropy — 여백의 정원',
    sound: Object.freeze({
      enable: '소리 켜기',
      disable: '소리 끄기',
    }),
    progressLabel: 'Entropy 선언문을 통과하는 정원의 시간',
    skipToInvitation: '설치 초대로 건너뛰기',
    artifactTraceLabel: '현재 콘텐츠에 작용하는 아티팩트',
    artifactNames: Object.freeze({
      shoji: '쇼지',
      shishi: '시시오도시',
      furin: '후린',
    }),
    phases: Object.freeze({
      threshold: Object.freeze({
        eyebrow: 'ENTROPY — ZEN',
        title: '마찰 없는 웹은\n혼란을 없애지 않습니다.',
        body: '그 비용을 사용자 안쪽으로 밀어 넣을 뿐입니다.',
        note: '스크롤하여 정원의 시간을 움직이십시오.',
      }),
      manifesto: Object.freeze({
        eyebrow: 'MANIFESTO · 01',
        title: '웹은 마찰을 0으로 깎아\n뇌와 데이터 사이에\n직렬 통로를 뚫었습니다.',
        body: 'Entropy는 그 통로에 마찰을 되돌려 넣습니다. 다음 자극으로 넘어가기 전, 마음이 쓸 수 있는 작은 틈을 만듭니다.',
        citation: 'Entropy README에서 요약',
      }),
      friction: Object.freeze({
        eyebrow: 'LENS · SHOJI',
        title: '콘텐츠는 그대로지만,\n보상의 기울기는 낮아집니다.',
        body: '흑백화, 흐림, 신호 차폐와 텍스트 리듬은 다음 자극의 선명도와 즉시성을 먼저 낮춥니다.',
        interferenceLabel: '즉각적인 보상을 구성하는 신호',
      }),
      pause: Object.freeze({
        eyebrow: 'GATE · SHISHI-ODOSHI',
        title: '멈춤은 명령이 아니라\n작은 리듬으로 도착합니다.',
        body: '다음 문장은 아직 열리지 않습니다. 계속되는 움직임은 잠시 물을 채웁니다.',
        gateWaiting: '물이 차오르는 중',
        gateStrike: '한 번의 울림',
        gateReleased: '의도가 돌아올 만큼의 간격',
      }),
      reflection: Object.freeze({
        eyebrow: 'REFLECTION',
        title: '웹에는 마찰을.\n뇌에는 보호막을.',
        body: '사용 기록을 돌아보고, 나에게 맞는 보호 강도와 이용 시간을 조절할 수 있습니다.',
        citation: '나에게 맞는 보호',
      }),
      invitation: Object.freeze({
        eyebrow: 'ENTROPY · NIGHT',
        title: '의지가 돌아올 만큼의\n질감 있는 정지.',
        body: '이 정원은 충동을 처벌하지 않습니다. 다음 행동을 다시 자신의 것으로 만들 작은 여백을 둡니다.',
        cta: '이 정원을 브라우저에 들이기',
        ctaLabel: 'Chrome Web Store에서 Entropy 열기',
        localFact: '설정과 사용 기록, 분석 결과는 이 기기에서 처리·보관되며 외부로 자동 전송되지 않습니다.',
        privacy: '개인정보처리방침',
        support: '지원',
      }),
    }),
    reducedMotionNotice: '줄인 동작 모드: 아티팩트 효과는 정적인 상태 변화로 표현됩니다.',
  }),
  en: Object.freeze({
    localeName: 'English',
    documentTitle: 'Entropy — A Garden of Pause',
    sound: Object.freeze({
      enable: 'Turn sound on',
      disable: 'Turn sound off',
    }),
    progressLabel: 'A garden moving through the Entropy manifesto',
    skipToInvitation: 'Skip to the invitation',
    artifactTraceLabel: 'Artifacts acting on the current text',
    artifactNames: Object.freeze({
      shoji: 'Shoji',
      shishi: 'Shishi-odoshi',
      furin: 'Furin',
    }),
    phases: Object.freeze({
      threshold: Object.freeze({
        eyebrow: 'ENTROPY — ZEN',
        title: 'A frictionless web\ndoes not remove disorder.',
        body: 'It only moves the cost inward.',
        note: 'Scroll to move time through the garden.',
      }),
      manifesto: Object.freeze({
        eyebrow: 'MANIFESTO · 01',
        title: 'The web cut friction to zero\nand opened a direct channel\nbetween data and the mind.',
        body: 'Entropy puts friction back into that channel, leaving a small interval the mind can use before the next stimulus.',
        citation: 'Condensed from the Entropy README',
      }),
      friction: Object.freeze({
        eyebrow: 'LENS · SHOJI',
        title: 'The content remains.\nIts reward gradient softens.',
        body: 'Grayscale, blur, signal shielding, and text rhythm first reduce the clarity and immediacy of the next stimulus.',
        interferenceLabel: 'Signals that compose immediate reward',
      }),
      pause: Object.freeze({
        eyebrow: 'GATE · SHISHI-ODOSHI',
        title: 'A pause arrives as rhythm,\nnot as a command.',
        body: 'The next line is not open yet. For a moment, continued movement only fills the bamboo.',
        gateWaiting: 'Water is gathering',
        gateStrike: 'One quiet strike',
        gateReleased: 'Enough space for intention to return',
      }),
      reflection: Object.freeze({
        eyebrow: 'REFLECTION',
        title: 'Friction for the web.\nA shelter for the mind.',
        body: 'Review your usage and adjust protection and time limits to suit you.',
        citation: 'Protection that fits you',
      }),
      invitation: Object.freeze({
        eyebrow: 'ENTROPY · NIGHT',
        title: 'A textured pause,\nlong enough for intention to return.',
        body: 'This garden does not punish impulse. It leaves a small interval in which the next action can become yours again.',
        cta: 'Bring this garden into your browser',
        ctaLabel: 'Open Entropy in the Chrome Web Store',
        localFact: 'Settings, usage records, and analysis results are processed and stored on your device and are not automatically sent to external services.',
        privacy: 'Privacy',
        support: 'Support',
      }),
    }),
    reducedMotionNotice: 'Reduced motion: artifact effects are expressed through still state changes.',
  }),
});

const REQUIRED_PHASE_IDS = Object.freeze([
  'threshold',
  'manifesto',
  'friction',
  'pause',
  'reflection',
  'invitation',
]);

function requireCopyContract(copy, locale) {
  if (!copy || typeof copy !== 'object') {
    throw new Error(`LANDING_COPY_REQUIRED:${locale}`);
  }
  if (!copy.skipToInvitation || !copy.artifactTraceLabel) {
    throw new Error(`LANDING_COPY_CHROME_REQUIRED:${locale}`);
  }
  REQUIRED_PHASE_IDS.forEach((phaseId) => {
    if (!copy.phases?.[phaseId]?.title) {
      throw new Error(`LANDING_COPY_PHASE_REQUIRED:${locale}:${phaseId}`);
    }
  });
  if (!copy.phases.invitation.cta || !copy.phases.invitation.ctaLabel) {
    throw new Error(`LANDING_COPY_INVITATION_REQUIRED:${locale}`);
  }
  if (!copy.phases.friction.interferenceLabel || !copy.phases.friction.body) {
    throw new Error(`LANDING_COPY_INTERFERENCE_REQUIRED:${locale}`);
  }
  return copy;
}

export function resolveLandingLocale(candidate) {
  const normalized = String(candidate || '').trim().toLowerCase();
  return normalized === 'ko' || normalized.startsWith('ko-')
    ? LANDING_LOCALES.KO
    : LANDING_LOCALES.EN;
}

export function getLandingCopy(locale) {
  const canonicalLocale = resolveLandingLocale(locale);
  return requireCopyContract(COPY[canonicalLocale], canonicalLocale);
}
