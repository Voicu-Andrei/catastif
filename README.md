# Catastif

Aplicație desktop **locală** (Electron + React + SQLite) pentru gestiunea unei afaceri mici cu
produse configurabile (ex. ferestre): produse, clienți, furnizori, oferte/comenzi, achiziții,
fișiere, rapoarte și — într-o versiune viitoare — e-Factura (RO_CIUS). Totul rulează pe
calculatorul proprietarului; fără cont, fără cloud, fără server.

> Interfața este integral în limba română. Toate datele stau într-un singur fișier SQLite, cu
> backup/restaurare cu un clic.

## Instalare

Nu vrei să compilezi nimic? **[Ghidul de instalare pas cu pas »](docs/INSTALARE.md)** — descarci un
singur fișier de pe pagina [Releases](https://github.com/Voicu-Andrei/catastif/releases/latest) și
dai câteva clicuri. Fără linie de comandă, fără drepturi de administrator.

## Stadiu (etape de dezvoltare)

- **M0 — schelet + backup** ✅ shell Mantine în română, SQLite cu migrații, Setări, backup/restaurare.
- **M1 — date de bază** ✅ Produse, Clienți, Furnizori (CRUD, căutare, atașamente).
- **M2 — comenzi** ✅ linii cu cost + preț + profit, ciclu Ofertă → Comandă → Anulată, plăți.
- **M3 — achiziții + stoc** ✅ istoric costuri, stoc opțional pe produs.
- **M4 — tablou de bord** ✅ date live, căutare globală, atașamente de fișiere.
- **M5 — documente & rapoarte** ✅ PDF oferte/comenzi, rapoarte cu grafice, export CSV/Excel/PDF.
- **M6 — împachetare & actualizare** ✅ electron-builder, actualizare automată (GitHub Releases), CI.

e-Factura este **amânată**: câmpurile fiscale există deja în schemă, dar generarea XML este un
substituent („în curând”). Aplicația **nu** gestionează niciodată datele de autentificare ANAF.

## Cum lansezi o versiune

1. Actualizează `version` în `package.json`.
2. Creează și împinge un tag: `git tag v0.1.0 && git push origin v0.1.0`.
3. GitHub Actions (`.github/workflows/release.yml`) construiește instalatoarele pe Windows și macOS
   și le publică pe pagina **Releases**. Aplicațiile instalate verifică actualizările la pornire.
4. Vezi câte descărcări ai: `npm run downloads`.

> Instalatoarele v1 sunt **nesemnate** — la prima instalare Windows poate afișa un avertisment
> SmartScreen („Mai multe informații → Executați oricum”). Actualizarea automată funcționează pe
> Windows; pe macOS necesită semnare (de adăugat ulterior).

## Documentație

- [`docs/SPECIFICATIE.md`](docs/SPECIFICATIE.md) — ce face aplicația și cum se leagă părțile între
  ele: modelul de date, ciclul de viață al comenzii, efectele pe stoc, formulele, suprafața API și
  lipsurile cunoscute. Scrisă pentru cineva care reconstruiește ideile pe altă platformă.
- [`docs/INSTALARE.md`](docs/INSTALARE.md) — instalare și actualizare pe Windows.
- [`docs/blueprint.md`](docs/blueprint.md) — planul inițial al produsului.

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
