import { INSTAGRAM_SPLIT_FEEDBACK_CANDIDATE_SELECTOR } from './instagramProfile.js';

const SPLIT_LIKE_TEXT = /^\s*(좋아요|likes?)\s*(\d[\d,.]*\s*(?:천|만|억|K|M|B)?)\s*(개)?\s*$/i;
const VIEW_ALL_REPLIES_TEXT = /^\s*답글\s*\d[\d,.]*\s*개\s*모두\s*보기\s*$/;
const VIEW_REPLIES_TEXT = /^\s*답글\s*보기\s*\(\s*\d[\d,.]*\s*개\s*\)\s*$/;

export function getInstagramReplyReplacement(text) {
  if (VIEW_ALL_REPLIES_TEXT.test(text)) return '답글 모두 보기';
  if (VIEW_REPLIES_TEXT.test(text)) return '답글 보기';
  return null;
}

// One native control, a direct numeric span, and direct label/unit Text nodes.
// This intentionally rejects captions, nested controls, icons and mixed prose.
export function getInstagramSplitLikeStructure(element) {
  if (!(element instanceof Element)
    || !element.matches(INSTAGRAM_SPLIT_FEEDBACK_CANDIDATE_SELECTOR)
    || element.childElementCount !== 1 || element.childNodes.length > 8) return null;
  const actionLabel = `${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''}`;
  if (/공유|저장|댓글|답글|리포스트|share|save|comment|repl|repost/i.test(actionLabel)) return null;
  const count = element.firstElementChild;
  if (count.tagName !== 'SPAN' || count.childElementCount !== 0
    || count.hasAttribute('role') || count.hasAttribute('contenteditable')
    || count.childNodes.length > 4) return null;
  const children = [...element.childNodes].filter(node => node.nodeType !== 8);
  const countIndex = children.indexOf(count);
  const before = children.slice(0, countIndex);
  const after = children.slice(countIndex + 1);
  const countNodes = [...count.childNodes].filter(node => node.nodeType !== 8);
  if (before.length !== 1 || before[0].nodeType !== 3 || after.length > 1
    || after.some(node => node.nodeType !== 3)
    || countNodes.length === 0 || countNodes.some(node => node.nodeType !== 3)) return null;
  return { prefix: before[0], count, countNodes, suffixNodes: after };
}

export function getInstagramSplitLikeLabel(element, sourceText = element?.textContent) {
  const structure = getInstagramSplitLikeStructure(element);
  if (!structure) return null;
  const { prefix, count, countNodes, suffixNodes } = structure;
  const match = String(sourceText).match(SPLIT_LIKE_TEXT);
  if (!match || prefix.nodeValue.trim() !== match[1]) return null;
  const quantity = count.textContent.trim();
  const unit = suffixNodes.map(node => node.nodeValue).join('').trim();
  const ownsProjection = sourceText !== element.textContent;
  if (quantity !== match[2].trim() && !(ownsProjection && quantity === '')) return null;
  if (unit !== (match[3] || '') && !(ownsProjection && unit === '')) return null;
  return {
    label: match[1],
    parts: [
      { node: prefix, applied: match[1] },
      ...countNodes.map(node => ({ node, applied: '' })),
      ...suffixNodes.map(node => ({ node, applied: '' })),
    ],
  };
}
