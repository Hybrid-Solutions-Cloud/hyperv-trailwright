import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import metadata from './package.json' with { type: 'json' }

export default defineConfig({
  base: './',
  server: { watch: { ignored: /[\\/]\.artifacts(?:[\\/]|$)/ } },
  plugins: [react(), {
    name: 'release-metadata',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ name: metadata.name, version: metadata.version, commit: process.env.CI_COMMIT_SHA || 'development' }, null, 2) })
    },
  }],
})
