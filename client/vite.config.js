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
    // Generate source maps for debugging production issues
    sourcemap: false,
    // Target modern browsers
    target: 'es2020'
  }
})
