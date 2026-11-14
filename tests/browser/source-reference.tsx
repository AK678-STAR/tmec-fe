import { TrialTab } from '../../../Racehorse_Simulator_Web/src/ui/TrialTab';
import type { Sprites as ReferenceSprites } from '../../../Racehorse_Simulator_Web/src/render/sprites';
import { useSprites } from '../../src/features/simulation/native/render/sprites';
import { toHorseProfile } from '../../src/features/simulation/engine/horseMapper';
import scope from '../../src/features/simulation/native/SourceScope.module.css';

const horse = toHorseProfile({ id: 'h1', name: 'Atlas', status: 'ACTIVE', isMedicalLocked: false, weightKg: 480 }, 0);
export function SourceReference() {
  const { sprites, error } = useSprites();
  if (!sprites) return <p>{error || 'Loading reference sprites'}</p>;
  return <section className={scope.scope} data-native-simulator data-testid="source-reference">
    <TrialTab horse={horse} sprites={sprites as ReferenceSprites} speed={1} sessionId="WORKOUT-reference"
      initialWorkout={{ surface: 'GRASS', distance: 800, intensity: 'HEAVY', condition: 'GOOD', obstacles: [] }} onIncident={() => {}} />
  </section>;
}
