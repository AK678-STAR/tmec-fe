import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LockOrDeactivateModal } from '../../src/features/accounts/components/LockOrDeactivateModal';
import type { PublicAccount } from '../../src/shared/types/auth';
import '../../src/shared/i18n';
import '../../src/shared/styles/tokens.css';
import '../../src/shared/styles/global.css';

const target: PublicAccount = {
  id: 'groom-test', fullName: 'Test Groom', email: 'groom@gmail.com', phone: '',
  role: 'GROOM', status: 'ACTIVE', createdAt: '2026-07-01T00:00:00Z',
  lastActive: null, requestedAt: null, requestCode: null, lockedAt: null, invitedBy: null,
  statusReason: null, statusChangedAt: null, statusChangedBy: null,
  permissions: { viewHorses: true, editHorses: false, deleteHorses: false, createPlan: false,
    assignSchedule: false, recordMetrics: false, ackAlerts: false, viewMedical: false,
    placeLock: false, liftLock: false, manageAccounts: false, viewAudit: false },
  permissionsChangedAt: null, permissionsChangedBy: null,
  notify: { thresholdAlert: false, lockLifted: false, dailyDigest: false, raceResults: false },
};

function Fixture() {
  const [result, setResult] = useState('');
  const action = new URLSearchParams(location.search).get('action') === 'deactivate' ? 'deactivate' : 'lock';
  return <>
    <output data-testid="confirmation">{result}</output>
    <LockOrDeactivateModal action={action} target={target} onCancel={() => setResult('cancelled')}
      onConfirm={(reason, confirmedActiveAssignments) => setResult(JSON.stringify({ reason, confirmedActiveAssignments }))} />
  </>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
