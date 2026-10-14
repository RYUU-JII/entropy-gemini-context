import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

import { usePopupSiteController } from '../../domains/tracking/index.js';
import PopupPage from '../../ui-kit/popup/PopupPage.jsx';
import PopupFirstSetupGuidance from './PopupFirstSetupGuidance.jsx';
import PopupSecurityVaultBoundary from './PopupSecurityVaultBoundary.jsx';

export default function PopupApp() {
  return <PopupSecurityVaultBoundary><PopupRuntime /></PopupSecurityVaultBoundary>;
}

function PopupRuntime() {
  const { t } = useAppTranslation('common');
  const popupSite = usePopupSiteController({ t });

  return <>
    <PopupFirstSetupGuidance isReady={popupSite.isReady} managedSiteCount={popupSite.snapshot.access.managedSiteCount} sitesHref={popupSite.sitesHref} />
    <PopupPage {...popupSite} t={t} />
  </>;
}
