import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const certDir = resolve(__dirname, 'certs')
const keyFile = resolve(certDir, 'key.pem')
const certFile = resolve(certDir, 'cert.pem')
const hasDevCerts = fs.existsSync(keyFile) && fs.existsSync(certFile)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  clearScreen: false,
  server: {
    https: hasDevCerts
      ? {
          key: fs.readFileSync(keyFile),
          cert: fs.readFileSync(certFile),
        }
      : undefined,
    host: '0.0.0.0', // Listen on all network interfaces (localhost + network)
    port: 1420,
    strictPort: true,
    hmr: {
      host: '192.168.1.171', // Replace with your local IP address
      port: 1420,
      protocol: 'https',
    },
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_BACKEND_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // to make use of `TAURI_DEBUG` and other env variables
  // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri supports es2021
    target: ['es2021', 'chrome100', 'safari13'],
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
