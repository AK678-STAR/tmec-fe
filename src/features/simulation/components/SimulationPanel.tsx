import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '@/shared/components/layout/AuthProvider';
import { Alert } from '@/shared/components/ui/Alert';
import { loadSimulationContext } from '../api';
import { canSimulate, createSessionModel, isSafeRecovery, type SessionModel, type SimulationMode } from '../model';
import { flushPendingRetries, getInflightMessages, useEventAcknowledged } from '../engine/socketTransport';
import { onBusEvent } from '../engine/bus';
import { useSimulationSocket } from '../hooks/useSimulationSocket';
import { useSprites } from '../native/render/sprites';
import { TrialTab } from '../native/ui/TrialTab';
import { RaceTab } from '../native/ui/RaceTab';
import { VetZone } from '../native/ui/VetZone';
import scope from '../native/SourceScope.module.css';
import ui from '../native/ui/ui.module.css';
import '../native/fonts.css';

export interface SimulationPanelProps {
  sessionId: string; mode: SimulationMode; onComplete: () => void; quick?: boolean;
  onActiveChange?: (active: boolean) => void; onReturn?: () => void;
}
export function SimulationPanel(props: SimulationPanelProps) {
  const user = useCurrentUser();
  const { t } = useTranslation();
  if (!canSimulate(user.role, props.mode)) return <Alert tone="danger" title={t('simulation.forbidden')} />;
  return <NativeSession key={props.sessionId} {...props} />;
}
function NativeSession({ sessionId, mode, onComplete, quick = false, onActiveChange, onReturn }: SimulationPanelProps) {
  const { t } = useTranslation();
  const { sprites, error: spriteError } = useSprites();
  const [model, setModel] = useState<SessionModel | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [finishId, setFinishId] = useState<string | null>(null);
  const { state, error: socketError } = useSimulationSocket(sessionId, !!model && !!sprites && !error && !spriteError);
  const acknowledged = useEventAcknowledged(finishId);
  const completeRef = useRef(onComplete);
  const notified = useRef(false);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    let active = true;
    void loadSimulationContext(sessionId, mode).then(context => {
      if (active) setModel(createSessionModel(context));
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : String(err)); });
    return () => { active = false; };
  }, [sessionId, mode]);
  useEffect(() => {
    if (acknowledged && !notified.current) { notified.current = true; completeRef.current(); }
  }, [acknowledged]);
  const active = !error && (running || !!finishId && !acknowledged);
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);
  useEffect(() => {
    if (!active) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [active]);
  useEffect(() => onBusEvent(entry => {
    if (!model || entry.event !== 'sys:medical_lock_sync' || entry.payload.medical_lock !== true) return;
    if (mode !== 'EXAM' && !isSafeRecovery(model.context) && model.horses.some(h => h.id === entry.payload.horse_id)) {
      setRunning(false); setError('MEDICAL_LOCK_ACTIVE');
    }
  }), [model, mode]);
  const onFinished = useCallback((id: string) => { setFinishId(id); setRunning(false); }, []);
  if (error || spriteError) return <Alert tone="danger" title={error ? t(`simulation.errors.${error}`, { defaultValue: error }) : t('simulation.assetError')}>{spriteError}</Alert>;
  if (!model || !sprites) return <p role="status">{t('simulation.loading')}</p>;
  const canRun = state === 'ONLINE' && !socketError;
  const context = model.race ? { ...model.context, surface: model.race.surface } : model.context;
  const workout = model.context.workout;
  return <section className={scope.scope} data-native-simulator data-testid="native-simulator" aria-label={t(`simulation.${mode}`)}>
    <div data-testid="simulation-panel">
      <section className={ui.card}>
        <div className={ui.cardHead}><h2 className={ui.cardTitle}>{t(`simulation.${mode}`)}</h2><span role="status">{t(`simulation.connection.${state}`)}</span></div>
        {mode !== 'EXAM' && <div className={ui.cardBody}><div className={ui.row}>
          <span className={ui.field}>{t('simulation.speed')}</span>
          <div className={ui.segmented} role="group" aria-label={t('simulation.speed')}>
            {[1, 10, 60, 0].map(value => <button key={value} type="button" className={ui.segment} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value ? `${value}×` : t('simulation.pause')}</button>)}
          </div>
        </div></div>}
      </section>
      {mode === 'WORKOUT' && <TrialTab horse={model.horses[0]} sprites={sprites} speed={speed} canRun={canRun} autoRun={quick}
        sessionId={sessionId} initialWorkout={{ surface: model.runs[0].surface, distance: workout!.distanceMeters,
          intensity: workout!.intensity === 'MEDIUM' ? 'MODERATE' : workout!.intensity as 'LIGHT' | 'MODERATE' | 'HEAVY', condition: 'GOOD', obstacles: [] }}
        onActivity={setRunning} onFinished={onFinished} />}
      {mode === 'RACE' && <RaceTab horses={model.horses} sprites={sprites} speed={speed} canRun={canRun} autoRun={quick}
        simulationContext={context} sessionId={sessionId} onActivity={setRunning} onFinished={onFinished} />}
      {mode === 'EXAM' && <VetZone horses={model.horses} sprites={sprites} sessionId={sessionId} targetHorseId={model.horses[0].id}
        canRun={canRun} autoRun={quick} onActivity={setRunning} onFinished={onFinished} onReturn={() => onReturn?.()}
        />}
      {socketError && <Alert tone="danger" title={t('simulation.syncError')}>{socketError}
        {getInflightMessages().some(p => p.payload.session_id === sessionId) && <button className={ui.btn} type="button" onClick={flushPendingRetries}>{t('simulation.retry')}</button>}
      </Alert>}
      {finishId && <p role="status" className={acknowledged ? ui.noticeOk : ui.notice}>{t(acknowledged ? 'simulation.saved' : 'simulation.saving')}</p>}
      <section className={ui.card}><div className={ui.cardBody}>
        <p className={ui.hint}>{t('simulation.confirmNote')}</p>
        {mode === 'WORKOUT' && <p className={ui.hint}>{t('simulation.nativeRecoveryNote')}</p>}
      </div></section>
    </div>
  </section>;
}
