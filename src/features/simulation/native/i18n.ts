import i18n from '@/shared/i18n';
import en from './source-en.json';
import vi from './source-vi.json';

i18n.addResourceBundle('en', 'nativeSimulator', en, true, true);
i18n.addResourceBundle('vi', 'nativeSimulator', vi, true, true);

/** Source text stays intact as the key so translations do not change the original layout markup. */
export function st(text: string, values?: Record<string, unknown>): string {
  return i18n.t(text, { ...values, ns: 'nativeSimulator', keySeparator: false, nsSeparator: false, defaultValue: text });
}
