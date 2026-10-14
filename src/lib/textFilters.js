/**
 * 텍스트 변조 및 처리에 적합한 의미 있는 텍스트인지 검사합니다.
 * 짧은 게시글 제목, 댓글, 피드 본문(한국어/영어/CJK)을 포착하고 순수 기호/공백 노이즈를 필터링합니다.
 */
export function isMeaningfulText(text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length < 3 || trimmed.length > 5000) return false;

  // 최소 1글자 이상의 알파벳, 숫자, 또는 한글/한자/가나 문자가 포함되어 있어야 함 (순수 기호/문장부호 제외)
  if (!/[a-zA-Z0-9\u3131-\uD79D\u4e00-\u9fa5\u3040-\u30ff]/.test(trimmed)) return false;

  return true;
}