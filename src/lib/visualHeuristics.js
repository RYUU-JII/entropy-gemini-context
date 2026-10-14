/**
 * visualHeuristics.js
 * 
 * 엘리먼트의 특성을 분석하여 시각적 필터(블러, 채도 등) 적용 여부를 판단하는 휴리스틱 로직을 제공합니다.
 * 주로 컨텐츠성 이미지와 UI 아이콘/이모지를 구분하는 데 사용됩니다.
 */

/**
 * 해당 요소가 컨텐츠성 미디어(사진, 영상 등)인지, 아니면 단순 아이콘/이모지/뱃지인지 판정합니다.
 * @param {Element} el 
 * @returns {boolean} true면 아이콘/이모지로 판단하여 필터 제외 대상이 됨
 */
export function isLikelyEmojiOrIcon(el) {
    if (!el || typeof Element === 'undefined' || !(el instanceof Element)) return false;

    const parseDimension = (value, fallback) => {
        const parsed = Number.parseInt(String(value ?? ''), 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    // 1. 태그 기반 (SVG는 대부분 UI 아이콘이나 그래픽 요소임)
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'svg') return true;

    // 2. 크기 기반 판정 (가장 확실한 지표)
    // getBoundingClientRect는 렌더링 전에는 0일 수 있으므로, HTML 속성값도 함께 체크합니다.
    const w = el.getAttribute('width')
        ? parseDimension(el.getAttribute('width'), el.clientWidth)
        : el.clientWidth;
    const h = el.getAttribute('height')
        ? parseDimension(el.getAttribute('height'), el.clientHeight)
        : el.clientHeight;

    // 보통 32px 이하의 아주 작은 이미지는 아이콘, 뱃지, 혹은 이모지일 확률이 매우 높습니다.
    // (dc인사이드 딱지는 12x11이므로 여기서 걸러집니다.)
    if (w > 0 && h > 0 && w <= 32 && h <= 32) {
        return true;
    }

    // 3. 문맥(클래스, 속성) 키워드 판정
    const className = typeof el.className === 'string' ? el.className :
        (el.className && typeof el.className.baseVal === 'string' ? el.className.baseVal : '');

    const context = (
        className + ' ' +
        (el.getAttribute('alt') || '') + ' ' +
        (el.getAttribute('title') || '') + ' ' +
        (el.getAttribute('src') || '')
    ).toLowerCase();

    const iconKeywords = [
        'emoji', 'emoticon', 'icon', 'badge', 'sticker',
        'nikcon', 'symbol', 'logo', 'avatar_default', 'favicon'
    ];

    if (iconKeywords.some(kw => context.includes(kw))) {
        return true;
    }

    // 4. 투명도가 있는 아주 작은 GIF (보통 움직이는 이모지나 딱지)
    if (tagName === 'img' && el.getAttribute('src')?.includes('.gif') && w < 50 && h < 50) {
        return true;
    }

    return false;
}
