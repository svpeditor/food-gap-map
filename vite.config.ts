import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base './' — сборка открывается и на GitHub Pages (подпапка), и локально из dist
export default defineConfig({
  base: './',
  plugins: [react()],
  // xlsx грузится лениво, только когда пользователь выбирает Excel-файл
  build: { chunkSizeWarningLimit: 600 },
  test: { include: ['src/**/*.test.ts'] },
})
