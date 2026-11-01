import babel from '@rolldown/plugin-babel'
import stylex from '@stylexjs/unplugin'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

export default defineConfig(({ mode }) => ({
  // The StyleX dev server keeps a polling interval open, so Vitest never exits
  plugins:
    mode === 'test' ? [] : [stylex.vite(), react(), babel({ presets: [reactCompilerPreset()] })],

  test: {
    include: ['src/**/*.test.ts'],
  },

  lint: {
    ignorePatterns: ['dist/**'],
    plugins: ['typescript', 'react', 'unicorn', 'oxc'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
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
}))
