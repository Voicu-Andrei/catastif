# Catastif — Build Blueprint

> A free, local desktop app that helps a small-business manager run a configurable-product
> business (e.g. windows) in Romanian: products, customers, suppliers, orders, files, and
> e-Factura-ready invoices. This document is the handoff spec for the build conversation.
> Items are tagged **[DECIDED]** (locked in brainstorming) or **[OPEN]** (still to discuss).

---

## 1. What it is

Catastif is a single-user, single-machine app for a small-business owner. The whole thing —
interface, logic, and data — lives on their own computer. No cloud, no accounts, no server to
run. The owner installs it once and opens it like any normal program; their data persists across
restarts automatically.

- **Name:** Catastif (the old Romanian word for a merchant's ledger/account book). **[DECIDED]**
- **Language:** Romanian UI throughout. **[DECIDED]**
- **Audience:** small-business managers, non-technical. Installation must require zero terminal use.
- **Cost:** free.
- **Important terminology:** the people you buy from are **furnizori** (suppliers), not
  "distribuitori". Use `furnizor` consistently in the schema and UI.

---

## 2. Architecture & distribution **[DECIDED]**

The guiding principle: this is consumer software, not a developer repo. The owner should never
touch a command line.

- **Package as a desktop app.** Recommended: **Electron** (easiest to build, large ecosystem,
  ~150 MB bundle). Alternative: **Tauri** (much leaner ~10 MB, faster, but involves Rust).
  Default to Electron unless there's a reason to optimize size.
- **Frontend:** web tech (React or Vue) so the UI is modern and Romanian text is easy to handle.
- **Backend + database in one:** no separate running services. Embed the app logic and use
  **SQLite** — a single-file database, zero setup, lives on disk, persists across restarts.
- **Distribution:** build installers and publish them on the GitHub repo's **Releases** page.
  - Windows: `.exe` installer
  - macOS: `.dmg`
  - User flow: open Releases → download installer for their OS → double-click → open the app.
- **Backups:** because the entire business lives in one SQLite file, build a one-click
  **backup/export** (copy the `.db` file to a chosen folder) and a matching **restore/import**.
  This is non-negotiable for a non-technical owner — a dead laptop must not wipe the business.

### Out of scope for v1
- No multi-user / multi-device sync (confirmed single machine). Keep the door open by not
  hard-coding single-user assumptions into the schema, but do not build sync.

---

## 3. Core data model

Five primary entities, plus the line-items and payment records that make them work.

### Entity overview

```
Furnizori ──furnizează──► Produse ──(linii)──► Comenzi ◄──plasează── Clienți
                                                  │
                                                  ▼
                                              Factură (e-Factura)
Fișiere ──atașate la──► orice fișă (produs, client, furnizor, comandă)
```

### Key architectural decision: price lives on the line, not the product **[DECIDED]**

A configurable product (a window) has no fixed price — it has a *way of arriving at* one. So:

- A **Produs** is a lightweight **template / catalog entry** (name, unit, description, optional
  reference price). It exists mainly to pre-fill the line so the owner isn't retyping
  "Fereastră PVC..." every time.
- The **order line** is where the real numbers live. For **each line**, the owner enters:
  - **cost** (what they paid the furnizor for it), and
  - **sale price** (what they're charging the client).
- **Profit is computed**, never stored as a separate truth: `profit = sale_price − cost` per
  line, rolled up per order and per period.

This single decision solves both the fluctuating-purchase-price problem and the
custom-sale-price problem at once, because both numbers are captured fresh, per line, at the
moment of the transaction.

**Pricing is manual for v1** (owner types cost and sale price per line). **[DECIDED]**
Per-m² and price-grid calculators are **[OPEN / deferred]** — the line-item architecture leaves
room to add them later as optional helpers that simply fill in the same sale-price field, with
no rework. (See §7.)

### Buying as well as selling **[DECIDED]**

The app tracks both directions. Purchases from furnizori are recorded as their own entries; each
purchase line stamps the **actual cost paid on that date**. This gives a **cost history for free**
— there is no separate "price fluctuation" feature, it's just the trail of what was bought. A
product can display its latest or average purchase cost as a reference for margins.

### Stock is optional, per product **[DECIDED]**

Each product has a `track_stock` switch:
- **off** → treated as unlimited / not counted (the right default for made-to-order windows).
- **on** → quantity counted: purchases raise it, sales lower it; show low-stock warnings.

### Proposed fields (starting point — refine in build)

**Produs**
- `id`, `nume`, `descriere`, `unitate_masura` (default `buc`), `pret_referinta` (optional),
  `cota_tva` (VAT rate), `track_stock` (bool), `stoc_curent` (if tracked), `furnizor_id` (optional)

**Client**
- `id`, `tip` (`firma` | `persoana`) — **drives B2B vs B2C**, see §5
- `nume`, `cui` (if firma), `cnp` (if persoana, optional), `adresa`, `telefon`, `email`, `note`

**Furnizor**
- `id`, `nume`, `cui`, `adresa`, `telefon`, `email`, `note`

**Comanda** (also used for the Ofertă state — see §4)
- `id`, `numar`, `client_id`, `stare` (`oferta` | `comanda` | `anulata`),
  `data_creare`, `data_acceptare`, `total_fara_tva`, `total_tva`, `total`,
  `achitat` (amount paid), `rest_de_plata` (computed), `factura_id` (nullable)

**LinieComanda**
- `id`, `comanda_id`, `produs_id` (nullable — lines can be free-typed), `descriere`
  (includes the configuration text, e.g. "Fereastră PVC 120×150, alb, termopan"),
  `cantitate`, `unitate_masura`, `cost_unitar`, `pret_unitar`, `cota_tva`

**Achizitie / LinieAchizitie** (purchases from furnizori)
- `Achizitie`: `id`, `furnizor_id`, `data`, `total`
- `LinieAchizitie`: `id`, `achizitie_id`, `produs_id`, `cantitate`, `cost_unitar`, `data`

**Factura** (e-Factura — see §5)
- `id`, `serie`, `numar`, `comanda_id`, `client_id`, `data_emitere`, `data_scadenta`,
  `total_fara_tva`, `total_tva`, `total`, `stare_anaf` (e.g. `de_trimis` | `trimisa` |
  `validata` | `respinsa`), `xml_path`

**Fisier**
- `id`, `nume`, `cale` (path on disk), `tip`, `entitate_tip` (`produs`|`client`|`furnizor`|`comanda`),
  `entitate_id` — i.e. a file attaches to any record. (Physical storage approach is **[OPEN]**, see §6.)

---

## 4. Order lifecycle **[DECIDED]**

Three states, with a clean cancel exit:

```
        acceptă, plătește
Ofertă ───────────────────► Comandă
   │                           │
   │ renunțare                 │ anulare
   ▼                           ▼
         Anulată (păstrată în istoric)
```

- **Ofertă** — a priced quote, draft or sent to the customer. Built on the exact same line-item
  structure as an order, so accepting it requires no re-entry.
- **Comandă** — the customer has accepted and paid. **This is where the factură is issued.**
- **Anulată** — terminal, but the record is **kept, never deleted** (history + accounting trail).

Notes:
- **Payment isn't all-or-nothing.** Keep `achitat` / `rest_de_plata` on the order (deposit now,
  balance on delivery is common). The state flips to `comanda` on the deposit; the balance rides
  along as a visible number.
- **Cancelling never deletes** — it sets `stare = anulata`.
- **Storno is [OPEN / later].** Cancelling an order whose factură already went to ANAF is not a
  delete — it requires a credit note (storno) through e-Factura. For v1, allow free cancellation
  *before* invoicing and flag the post-invoice case as a later feature.

---

## 5. e-Factura requirements **[DECIDED to support — verify current rules at build time]**

The owner invoices a **mix of businesses and consumers**, so both B2B and B2C apply.

> ⚠️ These are time-sensitive regulatory facts gathered in mid-2026. Re-confirm current ANAF
> rules, format version, and deadlines before building the submission piece.

What we know:
- e-Invoicing via **RO e-Factura** is **mandatory** for Romanian-established suppliers, for both
  **B2B** (since Jan 2024) and **B2C** (since Jan 2025).
- Invoices must be a **structured XML**: **UBL 2.1**, following the **RO_CIUS / EN 16931** spec.
- From 2026, invoices must be transmitted to the platform within **5 working days** of issuance.
- **B2B is a clearance model** — the invoice is not legally valid until **ANAF validates it**.
- Small taxpayers (turnover < €500k) had **penalty enforcement deferred to 1 July 2026**, but the
  obligation itself already applies.

### Design implications
- **Store all fiscal fields from day one** so generating the XML later is mechanical:
  - Seller identity (the owner's business: CUI, address, registration details — store in settings).
  - Buyer identity: **CUI** for a `firma`, **CNP / name+address** for a `persoana`. The client's
    `tip` field drives the B2B-clearance vs B2C-reporting path.
  - Invoice **serie + număr** (sequential numbering), issue date, due date, currency.
  - Per line: **description** (this is where the window's size/options text goes), quantity,
    unit of measure, **unit price without VAT**, **VAT rate**, line total. Plus VAT breakdown and
    totals at invoice level.
- **Generate the RO_CIUS XML** — strongly prefer an existing UBL/CIUS library over hand-rolling.
- **Submission is a separate, owner-driven step.** The app generates the XML; the owner uploads it
  to their **SPV** account (manual upload needs a qualified electronic signature), or — later — via
  the ANAF API. **The app must never handle the owner's ANAF credentials.**
- Keep the invoice line *boring*: the clever pricing stays internal; on the factura a custom window
  is one clean line ("Fereastră PVC 120×150, alb, termopan — 1 buc — 640 lei") so the VAT math is
  standard.

---

## 6. Status page (dashboard) **[DECIDED — layout OPEN]**

The home screen surfaces the state of the business. Every number below already exists in the model.

- **Oferte în așteptare** — offers sent but not yet accepted (what to chase).
- **Comenzi active** — confirmed orders in progress, grouped by stage.
- **De încasat** — total outstanding balances across orders ("who owes me money").
- **Profit** — sales minus cost over a period (free, since each line carries both numbers).
- **Stoc scăzut** — only for products with `track_stock` on.
- **Facturi de trimis la ANAF** — reminder list tied to the 5-working-day deadline. *Highest-value
  widget* — missing the deadline carries real penalties.
- **Activitate recentă** — latest offers, orders, payments.

Exact layout / which widgets are primary is **[OPEN]** — good first thing to mock up with Claude Code.

---

## 7. Open questions for the next brainstorm

- **Files (§3 Fisier):** how files are physically stored (copied into an app data folder next to
  the SQLite file? referenced in place?) and how they're included in the backup. Recommended:
  copy into a managed folder so backup/restore covers them too.
- **Backup specifics:** manual export only, or also an automatic periodic copy? Where to default.
- **Search:** global search across products / clients / orders, and per-list filtering.
- **Dashboard layout:** which widgets lead, mobile-style cards vs table-dense.
- **Pricing helpers (deferred):** per-m² formula and size-grid lookup — both fill the same
  sale-price field. Grid convention: round size up to the next bracket (matches supplier quotes).
- **VAT rates:** which rates the business uses; per-product default vs per-line override.
- **Invoice numbering:** serie format and reset rules (per year?).
- **Storno / credit notes:** post-invoice cancellation handling.

---

## 8. Suggested build order

1. **Skeleton:** Electron + React + SQLite, app opens, persists, Romanian UI shell.
2. **Backup/restore** of the SQLite file (build this early — it's the safety net).
3. **Master data:** Produse, Clienți, Furnizori CRUD.
4. **Orders with line items:** manual cost + sale price per line; Ofertă → Comandă → Anulată states.
5. **Purchases** from furnizori → cost history; optional stock counting + low-stock warnings.
6. **Status page** wired to live data.
7. **Invoices:** fiscal fields, then RO_CIUS XML generation. Submission stays a manual owner step.
8. **Files** attached to records, included in backup.
9. **Later:** pricing helpers (per-m², grid), storno, refinements.
