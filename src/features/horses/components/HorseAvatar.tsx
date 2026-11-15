import { DEFAULT_HORSE_AVATAR, resolveHorseAvatar } from '../constants/avatars';

export function HorseAvatar({ url, horseCode, name, size = 48 }: {
  url?: string | null;
  horseCode?: string | null;
  name: string;
  size?: number;
}) {
  return <img src={resolveHorseAvatar(url, horseCode)} alt={name} width={size} height={size}
    style={{ objectFit: 'cover', borderRadius: '50%', flexShrink: 0, background: 'var(--surface)' }}
    onError={e => { if (e.currentTarget.src !== DEFAULT_HORSE_AVATAR) e.currentTarget.src = DEFAULT_HORSE_AVATAR; }} />;
}
