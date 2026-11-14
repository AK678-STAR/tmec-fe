import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import appConfig from '../../vite.config.ts';

// The reference UI is read only in parity tests; production has no sibling-repo imports.
export default mergeConfig(appConfig, defineConfig({
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { open: false, fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] } },
}));
