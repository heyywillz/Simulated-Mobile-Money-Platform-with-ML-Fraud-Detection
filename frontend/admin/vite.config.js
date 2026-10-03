import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@momo/shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
  server: {
    port: 5174,
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**', '**/Project Researcher Paper/**', '**/backend/**', '**/machine-learning-engine/**'],
    },
  },
})
