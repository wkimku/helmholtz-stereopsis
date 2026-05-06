import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set VITE_BASE_PATH to "/<repo-name>/" when deploying to GitHub Pages.
const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
})
