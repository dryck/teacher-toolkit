import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom only for the component tests; the pure-logic files do not need it
    // but a single environment keeps the config honest and the runs fast.
    environment: 'jsdom',
    globals: false
  }
})
