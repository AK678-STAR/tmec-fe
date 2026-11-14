import { useTranslation } from 'react-i18next';
import { useCallback, useRef } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import { SimulationPanel, type SimulationPanelProps } from './SimulationPanel';
import s from './Simulation.module.css';

export function SimulationOverlay({ onClose, ...props }: SimulationPanelProps & { onClose: () => void }) {
  const { t } = useTranslation();
  const activeRef = useRef(false);
  const onActiveChange = useCallback((active: boolean) => { activeRef.current = active; }, []);
  const drawer = props.mode === 'EXAM';
  return <Modal title={t(`simulation.${props.mode}`)} width={drawer ? 680 : 1440} onClose={() => { if (!activeRef.current || window.confirm(t('simulation.leaveWarning'))) onClose(); }}
    overlayClassName={drawer ? s.drawerOverlay : s.cinematicOverlay} dialogClassName={drawer ? s.drawer : s.cinematic}>
    <SimulationPanel key={props.sessionId} {...props} onActiveChange={onActiveChange} onReturn={onClose} />
  </Modal>;
}
