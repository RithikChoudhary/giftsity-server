import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/seller': 'http://localhost:5001',
      '/api': 'http://localhost:5000'
    }
  }
})
