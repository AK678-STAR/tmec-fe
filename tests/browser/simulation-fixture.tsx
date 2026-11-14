import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, createMemoryRouter, RouterProvider, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../src/shared/components/layout/AuthProvider';
import { SimulationPanel } from '../../src/features/simulation/components/SimulationPanel';
import { SimulationOverlay } from '../../src/features/simulation/components/SimulationOverlay';
import type { SimulationMode } from '../../src/features/simulation/model';
import '../../src/shared/i18n';
import { ToastProvider } from '../../src/shared/components/ui/Toast';
import SessionResultPage from '../../src/features/training/pages/SessionResultPage';
import '../../src/shared/styles/tokens.css';
import '../../src/shared/styles/global.css';
import '../../src/shared/styles/theme-v2.css';
import { SourceReference } from './source-reference';

export function Fixture() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const query = new URLSearchParams(location.search);
  const mode = (query.get('mode') || 'WORKOUT') as SimulationMode;
  const props = { mode, sessionId: query.get('session') || `${mode}-ok`, quick: query.get('quick') === '1', onComplete: () => setCount(n => n + 1) };
  if (!auth.user) return <p>Loading user</p>;
  if (query.has('reference')) return <main><button>Open model</button><output>0</output><SourceReference /></main>;
  return <main><button onClick={() => setOpen(true)}>Open model</button><output data-testid="completions">{count}</output>
    {query.get('inline') ? <SimulationPanel {...props} /> : open && <SimulationOverlay {...props} onClose={() => setOpen(false)} />}
  </main>;
}
export function TrainingFixture() {
  const auth = useAuth();
  const navigate = useNavigate();
  return auth.user ? <ToastProvider><button onClick={() => navigate('/training/sessions/w2')}>Next workout</button><SessionResultPage /></ToastProvider> : <p>Loading user</p>;
}
const caller = new URLSearchParams(location.search).get('caller');
const trainingRouter = caller === 'training' ? createMemoryRouter([{ path: '/training/sessions/:id', element: <AuthProvider><TrainingFixture /></AuthProvider> }], { initialEntries: ['/training/sessions/w1'] }) : null;
createRoot(document.getElementById('root')!).render(<React.StrictMode>{trainingRouter ? <RouterProvider router={trainingRouter} /> : <MemoryRouter><AuthProvider><Fixture /></AuthProvider></MemoryRouter>}</React.StrictMode>);
