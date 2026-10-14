import React, { useEffect, useState } from 'react';
import { useSecurityVaultStatus } from '../../shared/security/useSecurityVaultStatus.js';
import { SecurityVaultControllerProvider } from '../../shared/security/SecurityVaultControllerContext.jsx';
import { DashboardProfileMutationHandoff, DashboardProfileMutationProvider, useDashboardProfileMutationOwner } from '../security/DashboardProfileMutationController.jsx';
import SecurityVaultBoundary from '../security/SecurityVaultBoundary.jsx';
import { useDashboardProfileMutationLifecycle } from './useDashboardProfileMutationLifecycle.js';
import DashboardProfileMutationRecovery from './DashboardProfileMutationRecovery.jsx';
import DashboardBootRecoverySurface from './DashboardBootRecoverySurface.jsx';
import { releaseDashboardThemeBootRuntimeHandoff } from './dashboardThemeBootRuntimeHandoff.js';

export default function DashboardAdmissionBoundary({ children }) {
  const vault = useSecurityVaultStatus();
  const profileMutation = useDashboardProfileMutationOwner();
  const [retainVaultReset, setRetainVaultReset] = useState(false);
  const profileGate = useDashboardProfileMutationLifecycle({
    generationReadinessEnabled: vault.status.protectionReady === true && !retainVaultReset,
    vaultAdmissionError: vault.error,
  });
  useEffect(() => {
    if (!['blocked', 'recovery_required'].includes(profileGate.status)) return;
    void releaseDashboardThemeBootRuntimeHandoff(`dashboard_profile_gate_${profileGate.status}`)
      .catch((error) => console.error('Dashboard theme boot runtime profile-gate cleanup failed.', error));
  }, [profileGate.status]);

  if (profileMutation.active && (profileGate.status !== 'admitted' || profileMutation.state.phase !== 'pending')) {
    return <DashboardProfileMutationHandoff controller={profileMutation} />;
  }
  if (!retainVaultReset && profileGate.status === 'pending') return <DashboardBootRecoverySurface />;
  if (!retainVaultReset && ['blocked', 'recovery_required'].includes(profileGate.status)) {
    return <DashboardProfileMutationRecovery
      lifecycle={profileGate.lifecycle}
      recovery={profileGate.recovery || null}
      settingsRecovery={profileGate.settingsRecovery || null}
    />;
  }
  return <SecurityVaultBoundary vault={vault} onResetFlowRetentionChange={setRetainVaultReset}>
    <SecurityVaultControllerProvider controller={vault}>
      <DashboardProfileMutationProvider controller={profileMutation}>
        {profileGate.status === 'admitted' ? children : <DashboardBootRecoverySurface />}
      </DashboardProfileMutationProvider>
    </SecurityVaultControllerProvider>
  </SecurityVaultBoundary>;
}
