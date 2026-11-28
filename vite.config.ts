import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          const srcAssets = path.resolve(import.meta.dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            includeDependenciesRecursively: false,
            groups: [
              {
                name: 'vendor-react',
                test: /\/node_modules\/(react|react-dom|scheduler)\//,
              },
              {
                name: 'vendor-motion',
                test: /\/node_modules\/(motion|motion-dom|motion-utils|framer-motion)\//,
              },
              { name: 'packMalaysian', test: /\/src\/games\/packMalaysianRenderers/ },
              { name: 'packChineseViral', test: /\/src\/games\/packChineseViral/ },
              { name: 'packGlobalViral', test: /\/src\/games\/packGlobalViral/ },
              { name: 'packRetroArcade', test: /\/src\/games\/packRetroArcade/ },
              { name: 'packSportsPhysics', test: /\/src\/games\/packSportsPhysics/ },
              { name: 'packChaosSurvival', test: /\/src\/games\/packChaosSurvival/ },
              { name: 'packStrategy', test: /\/src\/games\/packStrategyClassics/ },
              { name: 'packTabletop', test: /\/src\/games\/packTabletopGems/ },
              { name: 'packMindLogic', test: /\/src\/games\/packMindLogic/ },
              { name: 'packCrewDefense', test: /\/src\/games\/packCrewDefense/ },
              { name: 'packPhysicsBuilder', test: /\/src\/games\/packPhysicsBuilder/ },
              { name: 'packCultHeritage', test: /\/src\/games\/packCultHeritage/ },
              { name: 'newArcade', test: /\/src\/games\/newArcadeRenderers/ },
              { name: 'newBoard', test: /\/src\/games\/newBoardRenderers/ },
              { name: 'newCard', test: /\/src\/games\/newCardRenderers/ },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
