import React, { useEffect, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useDocumentVisibility } from '@/ui-kit/hooks/useDocumentVisibility.js';
import { guidanceClient } from '@/apps/shared/guidance/guidanceClient.js';

const POPUP_DOCUMENT_ID = crypto.randomUUID();
let popupAutomaticGuidePresented = false;
const isExpectedPreemption = failure => ['GUIDANCE_PRESENTATION_BUSY',
  'GUIDANCE_PROTECTION_PRESENTATION_BUSY', 'GUIDANCE_CLAIM_STALE'].includes(failure.message);

async function releaseItem(item) {
  item.settled = true;
  if (item.presentedRequest) await item.presentedRequest.catch((failure) => {
    if (!isExpectedPreemption(failure)) console.error('Popup guidance presentation failed.', failure);
  });
  await guidanceClient.release({ claimId: item.claim.claimId });
}

export default function PopupFirstSetupGuidance({ isReady, managedSiteCount, sitesHref }) {
  const { t } = useAppTranslation('guidance');
  const visible = useDocumentVisibility();
  const [claim, setClaim] = useState(null);
  const [error, setError] = useState(null);
  const claimRef = useRef(null);
  useEffect(() => {
    if (!isReady || managedSiteCount > 0 || !visible) {
      setClaim(null);
      return undefined;
    }
    if (popupAutomaticGuidePresented) return undefined;
    let cancelled = false;
    void guidanceClient.readState({ surface: 'popup' }).then(async (state) => {
      if (state.receipts['popup.first_setup']?.presentedAtMs || cancelled) return;
      const next = await guidanceClient.claim({ guideId: 'popup.first_setup', revision: 1,
        hostId: `popup:${POPUP_DOCUMENT_ID}`, documentId: POPUP_DOCUMENT_ID, visible: true, replay: false });
      if (cancelled || document.hidden) {
        await guidanceClient.release({ claimId: next.claimId });
        return;
      }
      claimRef.current = { claim: next, presentedRequest: null, presented: false, settled: false };
      setClaim(next);
    }).catch((failure) => {
      if (!cancelled && !isExpectedPreemption(failure)) setError(failure);
    });
    return () => {
      cancelled = true;
      if (claimRef.current) {
        void releaseItem(claimRef.current)
          .catch((failure) => console.error('Popup guidance release failed.', failure));
        claimRef.current = null;
      }
    };
  }, [isReady, managedSiteCount, visible]);
  useEffect(() => {
    if (!claim) return undefined;
    const frame = requestAnimationFrame(() => {
      const item = claimRef.current;
      if (document.hidden || !item || item.settled || item.claim.claimId !== claim.claimId) return;
      popupAutomaticGuidePresented = true;
      item.presentedRequest = guidanceClient.markPresented({ claimId: claim.claimId }).then(() => { item.presented = true; });
      void item.presentedRequest.catch((failure) => { if (!isExpectedPreemption(failure)) setError(failure); });
    });
    return () => cancelAnimationFrame(frame);
  }, [claim]);
  useEffect(() => {
    if (!claim || !visible) return undefined;
    const timer = setInterval(() => {
      const item = claimRef.current;
      if (!item || item.settled) return;
      void guidanceClient.renew({ claimId: item.claim.claimId }).catch((failure) => {
        if (claimRef.current !== item || item.settled) return;
        claimRef.current = null;
        setClaim(null);
        if (!isExpectedPreemption(failure)) setError(failure);
        void releaseItem(item).catch((releaseFailure) => console.error('Popup guidance release failed.', releaseFailure));
      });
    }, 10_000);
    return () => clearInterval(timer);
  }, [claim, visible]);
  const dismiss = () => {
    const current = claimRef.current;
    claimRef.current = null;
    setClaim(null);
    popupAutomaticGuidePresented = true;
    if (!current || current.settled) return;
    current.settled = true;
    void (async () => {
      try {
        if (current.presentedRequest) await current.presentedRequest;
        if (current.presented) await guidanceClient.dismiss({ claimId: current.claim.claimId });
        else await guidanceClient.release({ claimId: current.claim.claimId });
      } catch (failure) {
        await guidanceClient.release({ claimId: current.claim.claimId });
        if (!isExpectedPreemption(failure)) throw failure;
      }
    })().catch(setError);
  };
  if (!claim && !error) return null;
  return <aside className="popup-guidance" aria-live="polite" data-guidance-anchor="popup.first_setup">
    <span>{error ? t('common.failed', { message: error.message }) : t('guides.popup_first_setup')}</span>
    {!error && sitesHref && <a href={sitesHref} target="_blank" rel="noreferrer" onClick={dismiss}>{t('guides.garden_first_site')}</a>}
    <button type="button" aria-label={t('common.close')} onClick={() => { dismiss(); setError(null); }}>×</button>
  </aside>;
}
