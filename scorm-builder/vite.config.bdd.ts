import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// Vite configuration for BDD testing
export default defineConfig({
  plugins: [react()],
  
  // Define environment variables
  define: {
    'import.meta.env.MODE': JSON.stringify('test'),
    'import.meta.env.DEV': 'true',
    'import.meta.env.PROD': 'false'
  },
  
  // Prevent opening browser automatically
  server: {
    open: false,
    port: 1420
  },
  
  // Resolve paths
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})