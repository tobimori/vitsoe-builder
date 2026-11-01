import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
  lint: {
    ignorePatterns: ['dist/**'],
  },
  fmt: {
    semi: false,
    singleQuote: true,
  },
  run: {
    tasks: {
      dev: {
        command: 'portless run --name vitsoe vp dev',
        cache: false,
      },
      preview: {
        // Portless injects --port and --host only for `vp dev`
        command:
          "portless run --name vitsoe sh -c 'vp preview --port $PORT --strictPort --host $HOST'",
        dependsOn: ['build'],
        cache: false,
      },
      build: 'vp build',
      check: 'vp check',
      test: 'vp test run',
      deploy: {
        command: 'wrangler deploy',
        dependsOn: ['build'],
        cache: false,
      },
    },
  },
})
