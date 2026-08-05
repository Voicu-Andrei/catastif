import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'path'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { freshDb, testUserData } from './helpers'
import { closeDb } from '../src/main/db/connection'
import { getSetari, saveSetari } from '../src/main/db/repos/setari'
import { logoAbsolut, logoDataUri, logoDir, stergeLogo } from '../src/main/logo'

// PNG minim valid (1×1, transparent).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

function punLogo(nume = 'logo.png'): string {
  mkdirSync(logoDir(), { recursive: true })
  writeFileSync(join(logoDir(), nume), PNG)
  const rel = join('_firma', nume)
  saveSetari({ logo_path: rel })
  return rel
}

beforeEach(() => freshDb())
afterEach(() => closeDb())

describe('logo-ul firmei', () => {
  it('fără logo, nu se întoarce nimic', () => {
    expect(logoAbsolut()).toBeNull()
    expect(logoDataUri()).toBeNull()
  })

  it('calea salvată este relativă, ca backupul să fie portabil între calculatoare', () => {
    const rel = punLogo()
    expect(rel.startsWith('_firma')).toBe(true)
    // nicio urmă de cale absolută (alt utilizator = alt /home/... sau /Users/...)
    expect(getSetari().logo_path).not.toContain(testUserData())
  })

  it('se rezolvă în calea absolută și se codifică drept data:URI', () => {
    punLogo()
    expect(logoAbsolut()).toBe(join(testUserData(), 'atasamente', '_firma', 'logo.png'))
    expect(logoDataUri()).toMatch(/^data:image\/png;base64,iVBORw0K/)
  })

  it('un fișier lipsă de pe disc nu aruncă eroare', () => {
    saveSetari({ logo_path: join('_firma', 'inexistent.png') })
    expect(logoAbsolut()).toBeNull()
    expect(logoDataUri()).toBeNull()
  })

  it('un format nesuportat este ignorat, nu strică PDF-ul', () => {
    punLogo('logo.bmp')
    expect(logoDataUri()).toBeNull()
  })

  it('ștergerea elimină fișierul și setarea', () => {
    punLogo()
    stergeLogo()
    expect(existsSync(logoDir())).toBe(false)
    expect(getSetari().logo_path).toBeNull()
    expect(logoDataUri()).toBeNull()
  })

  it('logo-ul stă în folderul de atașamente, deci intră în backup', () => {
    punLogo()
    expect(logoDir()).toBe(join(testUserData(), 'atasamente', '_firma'))
  })
})
