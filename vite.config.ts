import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// MIRA · by Mezztt
export default defineConfig({
  plugins: [react()],
  server: { port: 5175 },
  preview: { port: 5175 },
})
