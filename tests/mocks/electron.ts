// Stub minimal pentru modulul 'electron' în teste (vitest rulează în Node).
// Testele setează CATASTIF_TEST_USERDATA către un folder temporar propriu.

export const app = {
  getPath(_name: string): string {
    const p = process.env.CATASTIF_TEST_USERDATA
    if (!p) {
      throw new Error('CATASTIF_TEST_USERDATA nu este setat — vezi tests/helpers.ts')
    }
    return p
  }
}
