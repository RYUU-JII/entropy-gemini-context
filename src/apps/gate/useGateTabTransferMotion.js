import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/** Capture live geometry before React moves a tab, including scroll and drift. */
export default function useGateTabTransferMotion(selectedTabIdsToClose, pending) {
  const tabNodesRef = useRef(new Map());
  const departureRef = useRef(null);
  const animationsRef = useRef(new Map());
  const transferLayerRef = useRef(null);

  const registerTabNode = useCallback((tabId, node) => {
    if (node) tabNodesRef.current.set(tabId, node);
    else tabNodesRef.current.delete(tabId);
  }, []);

  const cancelTransfers = useCallback(() => {
    animationsRef.current.forEach((cancel) => cancel());
    animationsRef.current.clear();
  }, []);

  const prepareTransfer = useCallback((tabId) => {
    // At most one flight: rapidly changing selection must never leave hidden tabs.
    cancelTransfers();
    const node = tabNodesRef.current.get(tabId);
    if (!node) return;
    departureRef.current = {
      tabId,
      rect: node.getBoundingClientRect(),
      ghost: node.cloneNode(true),
      hadFocus: document.activeElement === node,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  }, [cancelTransfers]);

  useLayoutEffect(() => {
    if (pending) {
      cancelTransfers();
      departureRef.current = null;
      return;
    }
    const departure = departureRef.current;
    departureRef.current = null;
    if (!departure) return;
    const node = tabNodesRef.current.get(departure.tabId);
    const layer = transferLayerRef.current;
    if (!node || !layer) return;
    if (departure.hadFocus) node.focus({ preventScroll: true });
    if (departure.reducedMotion || typeof node.animate !== 'function') return;

    const to = node.getBoundingClientRect();
    const from = departure.rect;
    const captured = selectedTabIdsToClose.includes(departure.tabId);
    const dx = to.left + to.width / 2 - from.left - from.width / 2;
    const dy = to.top + to.height / 2 - from.top - from.height / 2;
    const sx = to.width / from.width;
    const sy = to.height / from.height;
    const ghost = departure.ghost;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('tabindex', '-1');
    ghost.disabled = true;
    ghost.classList.add('gate-tab-flight');
    Object.assign(ghost.style, {
      position: 'fixed', left: `${from.left}px`, top: `${from.top}px`,
      width: `${from.width}px`, height: `${from.height}px`, margin: '0',
      transform: 'none', animation: 'none', pointerEvents: 'none',
    });
    layer.append(ghost);
    node.style.opacity = '0';

    const animation = ghost.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1, filter: 'blur(0px) brightness(1)', offset: 0 },
      { transform: `translate(${dx * .28}px, ${dy * .3 - 8}px) scale(1, .94)`, opacity: 1, filter: 'blur(.1px) brightness(1.15)', offset: .34 },
      { transform: `translate(${dx * .88}px, ${dy * .9 - 12}px) scale(${sx * 1.04}, ${sy * .9})`, opacity: .95, filter: 'blur(.15px) brightness(1.2)', offset: .78 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0, filter: 'blur(0px) brightness(1)', offset: 1 },
    ], { duration: captured ? 700 : 580, easing: 'cubic-bezier(.45,0,.22,1)' });
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      ghost.remove();
      node.style.removeProperty('opacity');
      animationsRef.current.delete(departure.tabId);
    };
    animationsRef.current.set(departure.tabId, () => { animation.cancel(); finish(); });
    animation.addEventListener('finish', finish, { once: true });
    animation.addEventListener('cancel', finish, { once: true });
  }, [cancelTransfers, pending, selectedTabIdsToClose]);

  useEffect(() => cancelTransfers, [cancelTransfers]);
  return { prepareTransfer, registerTabNode, transferLayerRef };
}
