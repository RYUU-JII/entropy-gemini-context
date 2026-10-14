import React, { useLayoutEffect, useRef, useState } from 'react';
import { ZenReadingBlock } from '../../api/homeReadingSpace.js';
import './zenLedgerPages.css';

// Presentation geometry only. Every item remains measurable, but only the
// current page participates in layout, focus and the accessibility tree.
export default function ZenLedgerPages({ items, anchor, onAnchor, t, className = '', onPage, hideSinglePageNavigation = false }) {
  const root = useRef(null);
  const nodes = useRef(new Map());
  const measuredFocus = useRef(null);
  const [pages, setPages] = useState(() => items.map((_, index) => [index, index + 1]));
  const keys = items.map(item => item.key).join('|');
  useLayoutEffect(() => {
    const measure = () => {
      const heights = items.map(item => {
        const node = nodes.current.get(item.key);
        if (!node) throw new Error('ZEN_LEDGER_PAGE_ITEM_REQUIRED');
        return Math.ceil(node.getBoundingClientRect().height);
      });
      const fullHeight = root.current.clientHeight;
      const fitsOnePage = hideSinglePageNavigation && heights.reduce((sum, height) => sum + height, 0) <= fullHeight;
      const available = fullHeight - (fitsOnePage ? 0 : 44);
      if (available <= 0) return; // An inactive/withdrawing surface has no paint area.
      const next = [];
      let start = 0;
      let used = 0;
      heights.forEach((height, index) => {
        if (index > start && used + height > available) {
          next.push([start, index]); start = index; used = 0;
        }
        used += height;
      });
      if (items.length > 0) next.push([start, items.length]);
      const active = document.activeElement;
      setPages(previous => {
        if (JSON.stringify(previous) === JSON.stringify(next)) return previous;
        if (root.current.contains(active)) measuredFocus.current = active;
        return next;
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root.current);
    nodes.current.forEach(node => observer.observe(node));
    measure();
    return () => observer.disconnect();
  }, [keys, hideSinglePageNavigation]);
  const anchorIndex = items.findIndex(item => item.key === anchor);
  let pageIndex = pages.findIndex(([start, end]) => anchorIndex >= start && anchorIndex < end);
  if (pageIndex < 0) pageIndex = 0; // Expired UI selection returns to the first page.
  const range = pages[pageIndex];
  useLayoutEffect(() => {
    const active = measuredFocus.current;
    measuredFocus.current = null;
    if (active !== null && (!active.isConnected || active.closest('[inert], [aria-hidden="true"], [hidden]'))
      && root.current.getClientRects().length > 0) root.current.focus({ preventScroll: true });
  }, [pages, pageIndex]);
  useLayoutEffect(() => { onPage?.(pageIndex, pages.length); }, [onPage, pageIndex, pages.length]);
  const move = direction => onAnchor(items[pages[pageIndex + direction][0]].key);
  return <div ref={root} tabIndex={-1} className={'zen-ledger-pages ' + className}
    data-page-index={pageIndex} data-page-count={pages.length}>
    <div className="zen-ledger-pages__items">
      {items.map((item, index) => {
        const visible = range !== undefined && index >= range[0] && index < range[1];
        return <div key={item.key} ref={node => { if (node) nodes.current.set(item.key, node); else nodes.current.delete(item.key); }}
          className="zen-ledger-pages__item" data-page-visible={visible}
          inert={!visible ? true : undefined} aria-hidden={!visible ? true : undefined}>{item.content}</div>;
      })}
    </div>
    {(!hideSinglePageNavigation || pages.length > 1) && <ZenReadingBlock as="nav" className="zen-ledger-pages__navigation" aria-label={t('usage_ledger.pages')}>
      <button type="button" data-ledger-action="previous-page" aria-label={t('usage_ledger.page_previous')}
        disabled={pageIndex === 0} onClick={() => move(-1)}>←</button>
      <span aria-live="polite">{t('usage_ledger.page_status', { page: pages.length === 0 ? 0 : pageIndex + 1, total: pages.length })}</span>
      <button type="button" data-ledger-action="next-page" aria-label={t('usage_ledger.page_next')}
        disabled={pageIndex >= pages.length - 1} onClick={() => move(1)}>→</button>
    </ZenReadingBlock>}
  </div>;
}
