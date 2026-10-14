import React, { useRef } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useDashboardGuidance, useGuidanceAnchor, useGuidancePresenter } from './DashboardGuidanceProvider.jsx';

import { useInlineGuidanceReceipt } from './useInlineGuidanceReceipt.js';

export default function FurinInstallationReceipt({ enabled = true, children = null }) {
  const { t } = useAppTranslation('guidance');
  const guidance = useDashboardGuidance();
  const ref = useRef(null);
  const presenter = useGuidancePresenter('flare.first_installation');
  const ownedPresenter = enabled && presenter?.item.element === ref.current ? presenter : null;
  const currentInstallation = enabled ? guidance?.state?.pendingInstallation
    || (ownedPresenter?.item.replay === false ? ownedPresenter.item.installation : null) : null;
  useGuidanceAnchor({ guideId: 'flare.first_installation', elementRef: ref,
    presentation: 'anchor', enabled: enabled && Boolean(currentInstallation) });
  useInlineGuidanceReceipt(ownedPresenter, ref);
  if (!currentInstallation && children === null) return null;
  return <div ref={ref} className="min-w-0" data-furin-installation-inline="true">
    {currentInstallation && <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-on-surface-muted" role="status">
      <span>{t('installation.saved')}</span>
    </p>}
    {typeof children === 'function' ? children(ownedPresenter) : children}
  </div>;
}
