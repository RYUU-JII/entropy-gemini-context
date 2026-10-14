import React, { useLayoutEffect, useRef } from 'react';
import './sitesWorkspace.css';

export default function SitesWorkspace({ variant = 'standard', mode = 'ledger', minimal = false, notebookSpread = false, bounded = false, toolbar = null, notebookHeader = null, notices = null, registryPane = null, siteCap = null, detailPane = null, utilityOpen = false, utilityPane = null, contentReady = true, presentationKey = mode, presentationState = null }) {
  if (!['standard', 'open'].includes(variant)) throw new Error(`[SitesWorkspace] Unsupported workspace variant '${variant}'.`);
  if (!['ledger', 'notebook'].includes(mode)) throw new Error(`[SitesWorkspace] Unsupported workspace mode '${mode}'.`);
  const rootRef = useRef(null);
  const retained = presentationState?.footprints?.[presentationKey];
  useLayoutEffect(() => {
    if (!contentReady || !presentationState) return undefined;
    const root = rootRef.current;
    const regions = {
      registry: root.querySelector('.sites-sites-workspace__registry'),
      heading: root.querySelector('.sites-notebook-heading'),
      cap: root.querySelector('.sites-sites-workspace__site-cap'),
      detail: root.querySelector('.sites-sites-workspace__detail'),
    };
    const measure = () => {
      const height = root.getBoundingClientRect().height;
      if (height <= 0) return;
      const footprint = { height };
      for (const [name, node] of Object.entries(regions)) {
        if (node && !node.closest('[hidden]')) footprint[name] = node.getBoundingClientRect().height;
      }
      presentationState.footprints ||= {};
      presentationState.footprints[presentationKey] = footprint;
    };
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    Object.values(regions).forEach(node => { if (node) observer.observe(node); });
    return () => observer.disconnect();
  });
  const footprintStyle = !contentReady && retained ? {
    minHeight: bounded ? undefined : retained.height,
    ...Object.fromEntries(Object.entries(retained).filter(([name]) => name !== 'height')
      .map(([name, height]) => [`--sites-${name}-footprint`, `${height}px`])),
  } : undefined;
  return (
    <div ref={rootRef} className="sites-sites-workspace" data-variant={variant} data-mode={mode} data-presentation={minimal ? 'minimal' : 'standard'}
      data-notebook-spread={notebookSpread && mode === 'notebook' && !utilityOpen}
      data-content-pending={!contentReady} aria-busy={!contentReady} style={footprintStyle}>
      <div className="sites-sites-workspace__frame">
        {toolbar && <div className="sites-sites-workspace__toolbar">{toolbar}</div>}
        {notices && <div className="sites-sites-workspace__notices">{notices}</div>}
        <div className="sites-sites-workspace__body">
          <div className="sites-sites-workspace__master" hidden={utilityOpen || (mode !== 'ledger' && !notebookSpread)}>
            <aside className="sites-sites-workspace__registry">{registryPane}</aside>
          </div>
          <div className="sites-sites-workspace__selected" hidden={utilityOpen || mode !== 'notebook'}>
            {notebookHeader}
            <div className="sites-sites-workspace__reading">
              {siteCap && <aside className="sites-sites-workspace__site-cap">{siteCap}</aside>}
              <main className="sites-sites-workspace__detail">{detailPane}</main>
            </div>
          </div>
          {utilityPane && <div className="sites-sites-workspace__utility" hidden={!utilityOpen}>{utilityPane}</div>}
        </div>
      </div>
    </div>
  );
}
