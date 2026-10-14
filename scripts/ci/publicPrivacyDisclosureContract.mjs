// This checks public disclosure coverage, not the runtime's network boundary.
// Transport containment remains owned by the manifest and security-surface gate.
const SOURCE_PATHS = Object.freeze({
  readme: 'README.md',
  landingCopy: 'src/apps/landing/content/landingCopy.js',
  privacyPage: 'src/apps/landing/privacy/index.html',
});

const LOCAL_PROCESSING = /(?:기기.{0,40}(?:처리|저장|보관)|(?:processed|stored).{0,40}(?:your|this) device)/iu;
const NO_AUTOMATIC_TRANSFER = /(?:외부로 자동 전송되지|not automatically (?:sent|uploaded)|does not automatically (?:send|share))/iu;
const OBSOLETE_REMOTE_ICONS = /(?:permission-gated site-icon request|same-host icon policy|may (?:request|fetch|download).{0,80}(?:site-provided icon|icon host)|아이콘 호스트에서.{0,60}(?:가져|요청))/iu;
const UNSCOPED_CLAIMS = /(?:zero network access|no entropy backend|\ball (?:extension |user )?data (?:is|are) (?:fully )?encrypted\b|\bthe entire profile is encrypted\b)/iu;
const OBSOLETE_LOCK_CLAIMS = /(?:site protection and recording pause while locked|잠긴 동안 사이트 보호와 기록은 일시 정지|처음 대시보드를 열면 데이터 잠금 암호를 설정)/iu;

const REQUIRED_PRIVACY_TOPICS = Object.freeze([
  ['recording admission', /(?:before recording begins|until (?:you|the user) (?:choose|chooses))/iu],
  ['protected-site scope', /protected sites only/iu],
  ['all-site basic scope', /basic records across all sites/iu],
  ['no-records choice', /(?:no records|without recording)/iu],
  ['recording stop control', /(?:turn|switch) recording off/iu],
  ['stored-data deletion', /(?:delete|clear) (?:stored )?(?:analytics|records|data)/iu],
  ['user-directed file sharing', /you (?:decide|choose).{0,90}\bshare\b/iu],
  ['data-sale restriction', /(?:does not|do not) sell (?:user|your) data/iu],
  ['advertising restriction', /(?:not|never|or) use (?:it|data|records) for advertising/iu],
  ['Limited Use statement', /including the Limited Use requirements/iu],
]);

export function inspectPublicPrivacyDisclosures(sources) {
  const failures = [];
  for (const [key, sourcePath] of Object.entries(SOURCE_PATHS)) {
    const source = sources?.[key];
    if (typeof source !== 'string' || !source.trim()) {
      failures.push({ path: sourcePath, message: 'Public disclosure source is missing.' });
      continue;
    }
    const text = source.replace(/<[^>]*>/gu, ' ').replace(/\s+/gu, ' ').trim();
    const requireTopic = (label, pattern) => {
      if (!pattern.test(text)) failures.push({ path: sourcePath, message: `Missing ${label}.` });
    };
    requireTopic('device-local processing notice', LOCAL_PROCESSING);
    requireTopic('automatic-transfer notice', NO_AUTOMATIC_TRANSFER);
    if (OBSOLETE_REMOTE_ICONS.test(text)) {
      failures.push({ path: sourcePath, message: 'Remote icon-download disclosure conflicts with the local-cache implementation.' });
    }
    if (UNSCOPED_CLAIMS.test(text)) {
      failures.push({ path: sourcePath, message: 'Unscoped network or whole-profile encryption claim.' });
    }
    if (OBSOLETE_LOCK_CLAIMS.test(text)) {
      failures.push({ path: sourcePath, message: 'Mandatory startup passphrase or paused protection conflicts with log-only optional locking.' });
    }
    if (key === 'privacyPage') {
      for (const [label, pattern] of REQUIRED_PRIVACY_TOPICS) requireTopic(label, pattern);
    }
  }
  return failures;
}
