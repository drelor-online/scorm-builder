import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { compression } from 'vite-plugin-compression2'

export default defineConfig({
  // Disable caching to ensure fresh builds
  cacheDir: '.vite-temp',
  server: {
    port: 1420,
    strictPort: false
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]__[hash:base64:5]'
    },
    preprocessorOptions: {
      css: {
        charset: false
      }
    }
  },
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true
    }),
    // Compress assets
    compression({
      algorithm: 'gzip',
      threshold: 10240, // Only compress files larger than 10kb
      deleteOriginalAssets: false
    }),
    compression({
      algorithm: 'brotliCompress',
      threshold: 10240,
      deleteOriginalAssets: false
    })
  ],
  build: {
    target: 'es2018', // Modern browsers for smaller output
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react'
            }
            if (id.includes('dompurify') || id.includes('jszip')) {
              return 'vendor-utils'
            }
            if (id.includes('@testing-library') || id.includes('vitest')) {
              return 'vendor-test'
            }
            if (id.includes('web-vitals')) {
              return 'vendor-monitoring'
            }
            // All other vendor modules
            return 'vendor'
          }
          
          // Application chunks
          if (id.includes('src/components/DesignSystem')) {
            return 'design-system'
          }
          if (id.includes('src/services')) {
            return 'services'
          }
          if (id.includes('src/hooks')) {
            return 'hooks'
          }
        },
        // Optimize chunk naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : ''
          if (facadeModuleId && facadeModuleId.includes('.')) {
            return `assets/${facadeModuleId.split('.')[0]}-[hash].js`
          }
          return 'assets/[name]-[hash].js'
        }
      },
      // Tree shaking optimization
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        // drop_console: true, // Temporarily disabled for debugging
        drop_debugger: true,
        // pure_funcs: ['console.log', 'console.info', 'console.debug'], // Temporarily disabled
        passes: 2
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false,
        ecma: 2018
      }
    },
    // Optimize CSS
    cssMinify: true,
    cssCodeSplit: false, // Disable to ensure CSS variables are always available
    // Generate source maps for debugging
    sourcemap: 'hidden',
    // Increase chunk size warnings threshold
    chunkSizeWarningLimit: 1000,
    // Asset optimization
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    // Report compressed size
    reportCompressedSize: true
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime'
    ],
    exclude: [
      '@testing-library/react',
      'vitest'
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/styles': path.resolve(__dirname, './src/styles'),
      '@/constants': path.resolve(__dirname, './src/constants')
    }
  },
  clearScreen: false,
  // Enable experimental features for better performance
  experimental: {
    renderBuiltUrl(filename: string) {
      // Use relative paths for better caching
      return `./${filename}`
    }
  }
})