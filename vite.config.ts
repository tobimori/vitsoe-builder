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
})
