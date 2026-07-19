import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    server: {
      deps: {
        // @vierweb/avataaars uses ESM directory imports ("./avatar")
        // which Node.js ESM doesn't support. Inline so Vite resolves them.
        inline: ['@vierweb/avataaars'],
      },
    },
  },
})
