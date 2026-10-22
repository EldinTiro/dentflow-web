import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      // The clinics run on CET/CEST; midnight-boundary bugs (QA-008/009) only show off UTC.
      env: { TZ: 'Europe/Sarajevo' },
    },
  }),
)
