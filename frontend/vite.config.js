import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      }
    }
  },
  build: {
    assetsInlineLimit: 0, // Don't inline any assets
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Keep SVG files in assets folder with clean names  
          if (assetInfo.name?.endsWith('.svg')) {
            return 'assets/[name][extname]'; // Remove hash for easier debugging
          }
          return 'assets/[name].[hash][extname]';
        }
      }
    },
    // Force copy public files
    copyPublicDir: true
  },
  assetsInclude: ['**/*.svg'], // Ensure SVGs are treated as assets
  publicDir: 'public' // Explicitly set public directory
})
