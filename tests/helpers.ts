import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type Database from 'better-sqlite3'
import { getDb, closeDb } from '../src/main/db/connection'

// Deschide o bază curată într-un folder temporar nou și rulează migrațiile.
// Cheamă closeDb() în afterEach ca folderul să poată fi refolosit.
export function freshDb(): Database.Database {
  closeDb()
  process.env.CATASTIF_TEST_USERDATA = mkdtempSync(join(tmpdir(), 'catastif-test-'))
  return getDb()
}

export function testUserData(): string {
  return process.env.CATASTIF_TEST_USERDATA!
}
