import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/seller': 'http://localhost:5001',
      '/api': 'http://localhost:5000'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'react-hot-toast', 'react-helmet-async'],
          'vendor-http': ['axios']
        }
      }
    },
    sourcemap: false,
    target: 'es2020'
  }
})
