import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base './' — сборка открывается и на GitHub Pages (подпапка), и локально из dist
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { include: ['src/**/*.test.ts'] },
})
