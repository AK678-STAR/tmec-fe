import { useEffect } from 'react';
import { connectSimulatorTransport, disconnectSimulatorTransport, useTransportState, useTransportError } from '../engine/socketTransport';

export function useSimulationSocket(sessionId: string, enabled: boolean) {
  const state = useTransportState();
  const error = useTransportError();
  useEffect(() => {
    if (!enabled) return;
    connectSimulatorTransport({ sessionId });
    return disconnectSimulatorTransport;
  }, [sessionId, enabled]);
  return { state, error };
}
