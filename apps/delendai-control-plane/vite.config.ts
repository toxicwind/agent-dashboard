import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reportsDirectory: './coverage', // v8 requires coverageFilesDirectory/reportsDirectory
      exclude: ['src/**/*.test.ts', 'src/main.tsx'],
      thresholds: { statements: 90, lines: 90, functions: 90, branches: 70 },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PORT ?? 25156),
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:25162',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  preview: {
    host: '127.0.0.1',
    port: Number(process.env.PORT ?? 25156),
  },
})
