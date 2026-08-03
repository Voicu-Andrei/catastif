// Transformă erorile venite prin IPC în mesaje potrivite pentru utilizator.
// Electron împachetează erorile din main: „Error invoking remote method '…': Error: mesaj”.

// Numele clasei poate fi orice („Error:”, dar și „SqliteError:”, „TypeError:”),
// iar dacă nu-l tăiem, mesajul ajuns la utilizator începe cu el.
const PREFIX_IPC = /^Error invoking remote method '[^']+':\s*(?:\w*Error:\s*)?/

export function mesajEroare(err: unknown): string {
  const brut = err instanceof Error ? err.message : String(err)
  const msg = brut.replace(PREFIX_IPC, '').trim()
  if (msg.includes('FOREIGN KEY constraint failed')) {
    return 'Înregistrarea este folosită de alte date și nu poate fi modificată sau ștearsă.'
  }
  // better-sqlite3 aruncă `SqliteError`, al cărei mesaj este text englezesc
  // („database is locked”, „UNIQUE constraint failed: …”) — fără tiparele astea
  // ajungea neatins într-o interfață integral în română.
  if (/UNIQUE constraint failed/i.test(msg)) {
    return 'Există deja o înregistrare cu aceste date. Verifică numărul sau codul introdus.'
  }
  if (/database is locked|SQLITE_BUSY/i.test(msg)) {
    return 'Baza de date este ocupată în acest moment. Încearcă din nou peste câteva secunde.'
  }
  if (
    /SQLITE_|SqliteError|constraint failed|no such (table|column)|disk I\/O error|malformed/i.test(
      msg
    )
  ) {
    return 'A apărut o eroare la baza de date. Reîncearcă; dacă persistă, repornește aplicația.'
  }
  return msg || 'A apărut o eroare neașteptată.'
}
