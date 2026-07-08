// Transformă erorile venite prin IPC în mesaje potrivite pentru utilizator.
// Electron împachetează erorile din main: „Error invoking remote method '…': Error: mesaj”.

const PREFIX_IPC = /^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/

export function mesajEroare(err: unknown): string {
  const brut = err instanceof Error ? err.message : String(err)
  const msg = brut.replace(PREFIX_IPC, '').trim()
  if (msg.includes('FOREIGN KEY constraint failed')) {
    return 'Înregistrarea este folosită de alte date și nu poate fi modificată sau ștearsă.'
  }
  if (/SQLITE_|no such (table|column)/i.test(msg)) {
    return 'A apărut o eroare la baza de date. Reîncearcă; dacă persistă, repornește aplicația.'
  }
  return msg || 'A apărut o eroare neașteptată.'
}
