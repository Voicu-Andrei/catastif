import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// Testele rulează în Node, nu în Electron: modulul 'electron' este înlocuit
// cu un stub care indică un folder temporar (vezi tests/mocks/electron.ts).
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
      '@main': resolve(__dirname, 'src/main'),
      electron: resolve(__dirname, 'tests/mocks/electron.ts')
    }
  },
  test: {
    include: ['tests/**/*.test.ts']
  }
})
