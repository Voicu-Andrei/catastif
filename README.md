# Catastif

Aplicație desktop **locală** (Electron + React + SQLite) pentru gestiunea unei afaceri mici cu
produse configurabile (ex. ferestre): produse, clienți, furnizori, oferte/comenzi, achiziții,
fișiere, rapoarte și — într-o versiune viitoare — e-Factura (RO_CIUS). Totul rulează pe
calculatorul proprietarului; fără cont, fără cloud, fără server.

> Interfața este integral în limba română. Toate datele stau într-un singur fișier SQLite, cu
> backup/restaurare cu un clic.

## Stadiu (etape de dezvoltare)

- **M0 — schelet + backup** ✅ aplicație care pornește, shell Mantine în română, bază de date
  SQLite cu migrații, pagina **Setări** funcțională, backup/restaurare (manual + automat la
  închidere).
- M1 — date de bază (Produse, Clienți, Furnizori)
- M2 — comenzi cu linii (cost + preț + profit), ciclu Ofertă → Comandă → Anulată
- M3 — achiziții + stoc opțional
- M4 — tablou de bord + căutare globală + atașamente fișiere
- M5 — documente PDF (oferte/comenzi) + rapoarte (CSV / Excel / PDF + grafice)
- M6 — împachetare + actualizare automată (GitHub Releases) + CI

e-Factura este **amânată**: câmpurile fiscale există deja în schemă, dar generarea XML este un
substituent („în curând”). Aplicația **nu** gestionează niciodată datele de autentificare ANAF.

## Tehnologii

- **Electron** (proces principal + preload + renderer izolat, `contextIsolation`)
- **React + TypeScript + Vite** (`electron-vite`)
- **Mantine** (UI) + framer-motion (animații) + Tabler Icons
- **better-sqlite3** (bază de date încorporată, sincronă)
- **electron-builder** + **electron-updater** (instalatoare + actualizări)

## Dezvoltare

```bash
npm install        # instalează dependențele (rulează și electron-builder install-app-deps)
npm run dev        # pornește aplicația în mod dezvoltare (HMR)
npm run typecheck  # verificare de tipuri (main + renderer)
npm run build      # compilează cele trei procese în ./out
```

## Împachetare

```bash
npm run pack:dir   # build nepublicabil (pentru testare locală)
npm run dist       # instalatoare (.exe / .dmg / AppImage) în ./release
```

Convenții interne:

- Valorile monetare se stochează în **bani** (întreg = lei × 100).
- Schema bazei trăiește în `src/main/db/migrations.ts`, versionată prin `PRAGMA user_version`.
- Terminologie: folosim mereu **furnizor** (niciodată „distribuitor”).
