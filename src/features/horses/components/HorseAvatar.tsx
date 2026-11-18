import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { DEFAULT_HORSE_AVATAR, resolveHorseAvatar } from '../constants/avatars';

export function HorseAvatar({ url, horseCode, name, size = 48 }: {
  url?: string | null;
  horseCode?: string | null;
  name: string;
  size?: number;
}) {
  const src = resolveHorseAvatar(url, horseCode);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // Không có ảnh (hoặc ảnh lỗi): hiện icon ngựa kiểu Lucide làm avatar mặc định.
  if (src === DEFAULT_HORSE_AVATAR || failedSrc === src) {
    return (
      <span role="img" aria-label={name}
        style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-muted, var(--surface))', color: 'var(--muted)', border: '1px solid var(--border)' }}>
        <Icon name="horse" size={Math.round(size * 0.55)} />
      </span>
    );
  }

  return <img src={src} alt={name} width={size} height={size}
    style={{ objectFit: 'cover', borderRadius: '50%', flexShrink: 0, background: 'var(--surface)' }}
    onError={() => setFailedSrc(src)} />;
}
