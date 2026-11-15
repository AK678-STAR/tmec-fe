import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { tr } from '@/shared/i18n/tr';
import { compressImageFile } from '@/shared/utils/imageCompressor';
import styles from './ImagePicker.module.css';

export interface ImagePickerProps {
  value?: string;
  onChange: (url: string) => void;
  presets?: Array<{ url: string; label: string; sub?: string }>;
  label?: string;
  hint?: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

export function ImagePicker({ value, onChange, presets, label, hint, disabled, onBusyChange }: ImagePickerProps) {
  useTranslation();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [broken, setBroken] = useState<string>();
  const locked = disabled || busy;

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    try {
      onChange(await compressImageFile(file));
      setBroken(undefined);
    } catch (err) {
      setError(tr(err instanceof Error ? err.message : 'Could not read this image. Please choose another file.'));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div className={styles.picker} role="group" aria-labelledby={`${id}-label`} aria-busy={busy}>
      <span id={`${id}-label`} className={styles.label}>{label || tr('Image')}</span>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.row}>
        <div className={styles.preview}>
          {value && broken !== value
            ? <img src={value} alt={label || tr('Image')} onError={() => setBroken(value)} />
            : <span>{tr('No image')}</span>}
        </div>
        <div className={styles.actions}>
          {Boolean(presets?.length) && <Button type="button" tone="secondary" disabled={locked} onClick={() => setOpen(true)}>{tr('Choose a preset')}</Button>}
          <Button type="button" tone="secondary" disabled={locked} onClick={() => input.current?.click()}>{tr('Upload from device')}</Button>
          {value && <Button type="button" tone="secondary" disabled={locked} onClick={() => { onChange(''); setError(''); }}>{tr('Remove image')}</Button>}
        </div>
      </div>
      <input ref={input} id={id} hidden type="file" accept="image/*" disabled={locked} aria-label={label || tr('Upload from device')} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
      {busy && <p role="status">{tr('Compressing image…')}</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {open && <Modal title={tr('Choose a preset')} width={640} onClose={() => setOpen(false)}>
        <div className={styles.grid}>{presets?.map(p => (
          <button className={styles.preset} type="button" key={p.url} aria-pressed={value === p.url} onClick={() => { onChange(p.url); setError(''); setOpen(false); }}>
            <img src={p.url} alt="" loading="lazy" />
            <strong>{p.label}</strong>{p.sub && <span>{p.sub}</span>}
          </button>
        ))}</div>
      </Modal>}
    </div>
  );
}
