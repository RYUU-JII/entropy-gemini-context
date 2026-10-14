import React, { useLayoutEffect, useRef, useState } from 'react';
import i18n from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import { PermissionGate } from '../../dashboard/tabs/settings/components/PermissionGate.jsx';
import SettingsShell from '../../dashboard/tabs/settings/layout/SettingsShell.jsx';
import FirstUseRegistrationEditor from '../../dashboard/tabs/main/home/ZenInvitationKoiRegistrationEditor.jsx';
import SettingsWorkspaceSection from '../../dashboard/tabs/settings/sections/SettingsWorkspaceSection.jsx';
import { useAnalysisStore } from '../../dashboard/stores/useAnalysisStore.js';
import { buildLocalUsagePolicyPatch } from '../../../domains/settings/config/localUsagePolicy.js';
import koSettings from '../../../i18n/locales/ko/settings.js';
import koDashboard from '../../../i18n/locales/ko/dashboard.js';
import koCommon from '../../../i18n/locales/ko/common.js';
import koGuidance from '../../../i18n/locales/ko/guidance.js';
import koMain from '../../../i18n/locales/ko/main.js';
import koSites from '../../../i18n/locales/ko/sites.js';
import '../../dashboard/tailwind.css';

// Both visual paths use their actual surface translation owner.
const fixtureI18n = i18n;
let sceneId;

function SettingsRecordingScene({ signalReady }) {
  const rootRef = useRef(null);
  const [policy, setPolicy] = useState(() => buildLocalUsagePolicyPatch({
    dataCollectionMode: 'all_sites_minimal', precisionInsightsMode: 'protected_sites',
    precisionInsightsSignals: { clse: true, navigation: true },
  }));
  const setup = sceneId.includes('setup');
  const custom = sceneId.includes('custom');
  const workspace = sceneId.endsWith('/workspace');
  useLayoutEffect(() => {
    const root = rootRef.current;
    let frame;
    let customOpened = false;
    let detailsOpened = false;
    const prepare = () => {
      if (setup) {
        const editor = root.querySelector('[data-main-first-use-registration]');
        if (!editor || editor.getAttribute('aria-busy') !== 'false') return;
      }
      if (setup && custom && !customOpened) {
        customOpened = true;
        root.querySelector('[data-first-use-recording]').click();
        return;
      }
      if (!workspace && !setup && !detailsOpened) {
        const title = fixtureI18n.t('settings:recording.flow_details');
        const summary = Array.from(root.querySelectorAll('summary')).find((node) => node.firstElementChild?.textContent === title);
        if (!summary) return;
        detailsOpened = true;
        summary.click();
        return;
      }
      if (!workspace && !setup && root.querySelectorAll('[role="switch"]').length !== 3) return;
      observer.disconnect();
      frame = requestAnimationFrame(() => {
        if (document.documentElement.scrollWidth > window.innerWidth) throw new Error('SETTINGS_VISUAL_HORIZONTAL_OVERFLOW');
        signalReady();
      });
    };
    const observer = new MutationObserver(prepare);
    observer.observe(root, { childList: true, subtree: true, attributes: true });
    prepare();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [signalReady, setup, custom, workspace]);
  return (
    <I18nextProvider i18n={fixtureI18n}>
      <div ref={rootRef} className="h-screen bg-background font-sans text-on-surface">
        {setup ? <div className="relative mx-auto h-full w-full max-w-lg" style={{ '--zen-registration-editor-x': '50%', '--zen-registration-editor-y': '24%' }}>
          <FirstUseRegistrationEditor open firstUse appearance="surface" registrationAvailability={{ available: true }}
            onSubmit={async () => ({ ok: false, kind: 'cancelled' })} onBrowseWithoutRecording={() => {}} />
        </div> : (
          <SettingsShell eyebrowLabel="설정" sections={[
            { id: 'workspace', label: '일반' },
            { id: 'permissions', label: '기록과 분석' },
            { id: 'safety', label: '보안과 데이터' },
          ]} activeSectionId={workspace ? 'workspace' : 'permissions'} onSectionChange={() => {}}>
            {workspace ? <SettingsWorkspaceSection isRuntimeActive capabilityReady capabilityMessage=""
              notificationsConfig={{ enabled: false, sessionStart: { enabled: false }, sessionEnd: { enabled: false } }}
              notificationsStatusMessage="" onToggleNotificationsEnabled={() => {}}
              solarLocationProfile={{ mode: 'preset', presetId: 'seoul_kr' }} solarStatusMessage=""
              onSaveSolarLocation={() => {}} t={fixtureI18n.getFixedT('ko', 'settings')} /> : (
              <PermissionGate {...policy} permissionState={{ scripting: true }} precisionInsightsReady
              trackingExcludedUrls={[]} managedSiteCount={2} missingSiteCount={0}
              onUsagePolicyChange={(next) => setPolicy(buildLocalUsagePolicyPatch(next))}
              onRestoreTrackedDomain={() => {}} onGrantManagedSiteAccess={() => {}} />
            )}
          </SettingsShell>
        )}
      </div>
    </I18nextProvider>
  );
}

export default defineVisualSceneImplementation({
  Component: SettingsRecordingScene,
  prepare: async ({ manifest }) => {
    sceneId = manifest.id;
    if (sceneId.endsWith('/workspace')) {
      // Scene-local Zustand state only; no settings commands or storage writes.
      useAnalysisStore.setState({
        cycleState: { resetPolicy: { effectiveResetHour: 4, pending: null, recommendation: null } },
        cycleError: null,
      });
    }
    await fixtureI18n.init({
      lng: 'ko', resources: { ko: { settings: koSettings, dashboard: koDashboard, common: koCommon, guidance: koGuidance, main: koMain, sites: koSites } },
      ns: ['settings', 'dashboard', 'common', 'guidance', 'main', 'sites'], defaultNS: 'settings',
      fallbackLng: false, interpolation: { escapeValue: false },
    });
  },
});
