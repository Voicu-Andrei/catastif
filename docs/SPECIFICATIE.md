# Catastif — Application Specification

**What this document is for.** Catastif is a Windows desktop app (Electron + React + SQLite) that
runs a small manufacturing/installation business — the reference case is a company that builds and
fits windows. This document describes **what it does and how its parts connect**, so the ideas can
be rebuilt on a different platform.

It is written for someone who will **not** reuse this code. Everything below is behaviour, rules,
and data relationships, traced to the source. Electron/Windows packaging concerns are deliberately
omitted — they don't transfer to the web.

Every claim cites `file:line` from this repository, so anything ambiguous can be checked at source.

> **Language note.** The app's UI, database identifiers, and code comments are entirely in Romanian.
> This document is in English but keeps the Romanian identifiers exactly as they appear in the
> schema, because you will see them in the code. The glossary below maps them.

---

## Table of contents

1. [The product in one page](#1-the-product-in-one-page)
2. [Glossary](#2-glossary-romanian--english)
3. [The money convention — read this first](#3-the-money-convention--read-this-first)
4. [Data model](#4-data-model)
5. [The order lifecycle (the core state machine)](#5-the-order-lifecycle-the-core-state-machine)
6. [Feature inventory](#6-feature-inventory)
7. [The linkage map — how features change each other's data](#7-the-linkage-map)
8. [Derived values: what is computed, and where](#8-derived-values-what-is-computed-and-where)
9. [Validation rules](#9-validation-rules)
10. [The API surface (IPC) as a contract](#10-the-api-surface-ipc-as-a-contract)
11. [Screen inventory](#11-screen-inventory)
12. [What is NOT implemented](#12-what-is-not-implemented)
13. [Known gaps — fix these in the rewrite](#13-known-gaps--fix-these-in-the-rewrite)
14. [Design decisions worth keeping](#14-design-decisions-worth-keeping)

---

## 1. The product in one page

Catastif tracks the full commercial cycle of a small business:

```
  FURNIZORI ──buys from──> ACHIZIȚII ──increases──> STOC (per product)
  (suppliers)               (purchases)               │
                                 │                    │
                            sets ultim_cost           │ decreases
                                 │                    │
                                 v                    │
  PRODUSE (catalogue: cost + selling price + optional stock)
                                 │
                            fills in
                                 v
  CLIENȚI ──receives──> OFERTĂ ──accepted──> COMANDĂ ──> PLĂȚI (payments)
  (customers)          (quote)               (order)         │
                                                 │           │
                                                 v           v
                                          PDF documents   RAPOARTE (reports)
```

**The central idea, and the app's whole reason to exist:** every order line records **both what the
business pays** (`cost_unitar`) **and what it charges** (`pret_unitar`). Profit is therefore known
per line, per order, per customer, and per month — not just revenue. Most small-business tools track
only revenue; this one is built around margin.

**Operating model.** Fully local, single-user, no accounts, no server, no cloud. All data lives in
one SQLite file. This matters for the rewrite: several designs below (settings caching, absolute
stock writes, denormalised totals) are only safe *because* there is exactly one writer. **On the web,
with concurrent users, they are not safe.** These points are flagged throughout.

---

## 2. Glossary (Romanian → English)

| Romanian | English | Notes |
|---|---|---|
| catastif | ledger / register | the app's name |
| produs / produse | product(s) | catalogue item |
| client / clienți | customer(s) | `firma` (company) or `persoana` (individual) |
| furnizor / furnizori | supplier(s) | never "distributor" — house style |
| comandă / comenzi | order(s) | one record covers quote *and* order |
| ofertă | quote / offer | the initial state of a `comanda` |
| anulată | cancelled | terminal state |
| linie / linii | line item(s) | |
| achiziție / achiziții | purchase(s) | goods bought from a supplier |
| plată / plăți | payment(s) | customer payments against an order |
| stoc | stock / inventory | optional per product |
| preț | price | what the customer pays |
| cost | cost | what the business pays |
| cotă TVA | VAT rate | percent, e.g. `21` |
| fără TVA | excluding VAT | |
| bani | *money*, but here: **the integer unit** = lei × 100 | see §3 |
| lei / RON | Romanian currency | |
| factură / facturi | invoice(s) | **not implemented** — see §12 |
| raport / rapoarte | report(s) | |
| setări | settings | |
| fișier / fișiere | file(s) / attachments | |
| unitate de măsură (U.M.) | unit of measure | `buc`, `mp`, `ml` |
| buc / mp / ml | piece / m² / linear metre | |
| numar | number | document number |
| stare | state / status | |
| creat_la / actualizat_la | created_at / updated_at | |

---

## 3. The money convention — read this first

**Every monetary value in the database is an integer number of *bani* (1 leu = 100 bani).**
`shared/types.ts:2` states this normatively. Getting this wrong produces 100× errors in real money.

- `leiToBani(lei) = Math.round(lei * 100)` — `src/renderer/src/lib/money.ts:5`. **The only entry point.**
- `baniToLei(bani) = bani / 100` — `money.ts:3`. No rounding; may return a float.
- Display: `formatLei(bani)` → `"1.234,56 lei"` via `Intl` `ro-RO` — `lib/format.ts:9`.

**Columns in bani:** `produse.cost_referinta`, `produse.pret_referinta`, `linii_comanda.cost_unitar`,
`linii_comanda.pret_unitar`, `comenzi.total_fara_tva`, `comenzi.total_tva`, `comenzi.total`,
`comenzi.achitat`, `plati.suma`, `achizitii.total`, `linii_achizitie.cost_unitar`, all `facturi.total*`.

**Columns that are NOT money:** `produse.stoc_curent` and `produse.prag_stoc` are quantities (REAL,
can be fractional for m²/linear metres). `cantitate` on lines is REAL. `cota_tva` is a percent as
REAL (`21`, not `0.21`).

> ### ⚠️ Three traps to carry into the rewrite
>
> 1. **Conversion lives in the renderer, not in shared code.** `money.ts` sits in
>    `src/renderer/src/lib/`, so the backend has no conversion helper and duplicates its own
>    formatter (`src/main/pdf.ts:17`). In a web rewrite, put this in shared code used by both sides.
> 2. **The backend does not verify that money values are integers.** `cereBaniPozitivi`
>    (`src/main/db/validate.ts:27`) accepts any finite number ≥ 0, including `1234.56`. A caller that
>    sends lei instead of bani passes validation silently and is wrong by 100×. **Add an integer
>    check.**
> 3. **Reports and dashboard return bani.** Any new consumer must convert. The CSV/XLSX export
>    applies `baniToLei` per cell in the renderer (`Rapoarte.tsx`) — forget it in a new export and
>    the file ships raw bani.

---

## 4. Data model

Schema lives inline in TypeScript at `src/main/db/migrations.ts`, versioned via SQLite's
`PRAGMA user_version`. **Current version: 4.** Migrations run in order, each in its own transaction
(`src/main/db/migrate.ts:15-28`). `PRAGMA foreign_keys = ON` is set at connection time
(`src/main/db/connection.ts:70-71`) — without it every `ON DELETE` rule below would be inert.

### 4.1 `setari` — settings (key/value)

`cheie TEXT PRIMARY KEY`, `valoare TEXT` (JSON-serialised). Reads start from `DEFAULT_SETARI` and
overlay only *known* keys; corrupt JSON silently falls back to the default
(`src/main/db/repos/setari.ts:31-45`). Writes are a partial upsert.

| Key | Default | Who reads it |
|---|---|---|
| `nume_firma`, `cui`, `nr_reg_com`, `adresa`, `judet`, `oras`, `iban`, `telefon`, `email` | `''` | PDF header only (`pdf.ts:83-99`) |
| `cod_postal` | `''` | **nobody** |
| `logo_path` | `null` | PDF header (`pdf.ts:84`) — but cannot be set from the UI |
| `cota_tva_implicita` | `21` | default VAT on new products and new order lines |
| `serie_factura` | `'CTF'` | **nobody** |
| `numar_factura_curent` | `1` | **nobody** |
| `backup_folder` | `null` | backup routines |
| `auto_backup` | `false` | backup-on-quit |
| `prag_stoc_implicit` | `5` | low-stock threshold fallback |
| `versiune_ignorata` | `null` | auto-updater ("skip this version") |

### 4.2 `furnizori` — suppliers

`id` PK, `nume` **NOT NULL** (the only required field), `cui`, `nr_reg_com`, `adresa`, `telefon`,
`email`, `note`, `creat_la`, `actualizat_la`. Sorted `nume COLLATE NOCASE`.

Deletion is **blocked** if the supplier has purchases — explicit check with a Romanian message
(`repos/furnizori.ts:50-55`), backed by `ON DELETE RESTRICT` (`migrations.ts:102`). A successful
delete silently detaches products (`produse.furnizor_id ON DELETE SET NULL`).

Note: unlike `clienti`, suppliers have **no** `judet`/`oras`/`cod_postal`.

### 4.3 `clienti` — customers

`id`, `tip` (`'firma'` | `'persoana'`, default `'persoana'`, **no CHECK constraint**), `nume` NOT NULL,
`cui`, `nr_reg_com`, `cnp`, `adresa`, `judet`, `oras`, `cod_postal`, `telefon`, `email`, `note`, timestamps.

The company-vs-individual rule (`cui`+`nr_reg_com` for companies, `cnp` for individuals) is enforced
**only in the UI** (`Clienti.tsx:110-112`). The backend checks only that the name is non-empty and
`tip` is one of the two values. **Enforce this server-side in the rewrite.**

Deletion blocked if the customer has any order, in any state (`repos/clienti.ts:56-61`).

### 4.4 `produse` — products

| Column | Type | Meaning |
|---|---|---|
| `nume` | TEXT NOT NULL | name |
| `descriere` | TEXT NULL | description |
| `unitate_masura` | TEXT NOT NULL, default `'buc'` | closed list: `buc`/`mp`/`ml` |
| `cost_referinta` | INTEGER NULL | **bani** — what we pay per unit *(added in v3)* |
| `pret_referinta` | INTEGER NULL | **bani** — what we charge per unit |
| `cota_tva` | REAL NOT NULL, default 21 | VAT percent |
| `track_stock` | INTEGER NOT NULL, default 0 | 0/1 — is stock tracked? |
| `stoc_curent` | REAL NOT NULL, default 0 | quantity (fractional allowed) |
| `prag_stoc` | REAL NULL | low-stock threshold; NULL = use global default |
| `furnizor_id` | INTEGER NULL | `ON DELETE SET NULL` |

**The two-price design is essential.** Before v3 a product had only `pret_referinta`, while order
lines had *two* boxes (cost and price). The cost box could therefore only be filled from purchase
history, which is empty for any product never purchased — so the product's single value always
landed in the price box regardless of what the user meant by it. v3 split them
(`migrations.ts:191-195`). **A product in the rewrite must have both.**

- **Derived, not stored:** `ultim_cost` — the most recent `cost_unitar` from `linii_achizitie` for
  that product, `ORDER BY data DESC, id DESC LIMIT 1` (`repos/produse.ts:16-19`). Computed on every
  list/get.
- **Derived, not stored:** "low stock" = `stoc_curent <= COALESCE(prag_stoc, setari.prag_stoc_implicit)`.

> ⚠️ **`UPDATE` writes `stoc_curent` absolutely, from the form** (`repos/produse.ts:66`). It is not
> an incremental ledger. Saving a product card overwrites stock, discarding any movement that
> happened in between. Safe only because there's one user. **On the web this is a lost-update bug.**

### 4.5 `comenzi` — orders (quote → order → cancelled)

| Column | Meaning |
|---|---|
| `numar` | TEXT NULL, **no UNIQUE constraint** — uniqueness enforced in code only |
| `client_id` | `ON DELETE RESTRICT` |
| `stare` | `'oferta'` \| `'comanda'` \| `'anulata'`, default `'oferta'`, **no CHECK constraint** |
| `data_creare` / `data_acceptare` / `data_anulare` | timestamps per transition |
| `total_fara_tva`, `total_tva`, `total` | **bani, persisted** (denormalised from lines) |
| `achitat` | **bani, persisted** (denormalised from `plati`) |
| `observatii` | free text, printed on the PDF |
| `data_montaj` | `YYYY-MM-DD` NULL — scheduled installation day *(v4)* |
| `adresa_montaj` | TEXT NULL — installation address when it differs from the customer's *(v4)* |
| `detalii_montaj` | TEXT NULL — **internal** crew note, never printed *(v4)* |
| `montaj_finalizat_la` | TEXT NULL — recorded fact, written only via its own channel *(v4)* |
| `factura_id` | **dead column** — no FK, never written |

**Numbering:** if the user leaves the number blank, after INSERT it becomes `'C' + id` zero-padded to
4 (`repos/comenzi.ts:126-131`). Uniqueness is checked only for **user-entered** numbers
(`comenzi.ts:97-103`) — the auto-generated one is not checked, so it can collide with a manual number.

### 4.6 `linii_comanda` — order lines

`comanda_id` (`ON DELETE CASCADE`), `produs_id` (NULL allowed, `ON DELETE SET NULL`), `descriere`,
`cantitate` REAL, `unitate_masura`, `cost_unitar` (bani), `pret_unitar` (bani), `cota_tva`, `pozitie`.

**Lines are snapshots.** Cost, price, VAT, and unit are *copied onto the line* at entry — they are
never re-read from the product afterwards. Changing a product's price does not alter historical
orders. This is correct and must be preserved.

`produs_id` is optional: a line can be pure free text. **Only lines with a `produs_id` move stock.**

> ⚠️ On update, lines are **deleted and re-inserted wholesale** (`comenzi.ts:165-166`), so line IDs
> are not stable across saves. Anything referencing a line ID (attachments, audit) would break.

### 4.7 `plati` — payments *(added in v2)*

`comanda_id` (`ON DELETE CASCADE`), `suma` INTEGER (bani, **negative = correction**), `data`, `creat_la`.

**Invariant: `SUM(plati.suma) == comenzi.achitat`.** Maintained by clamping — the code computes
`nouAchitat = max(0, achitat + round(suma))` and inserts the **delta actually applied**, not the
requested amount (`comenzi.ts:225-228`). A −999 correction against 100 paid inserts −100. A zero
delta inserts no row.

There is **no IPC channel to edit or delete a payment.** Corrections are the only mechanism.

### 4.8 `achizitii` + `linii_achizitie` — supplier purchases

Head: `furnizor_id` (`ON DELETE RESTRICT`), `data` (`YYYY-MM-DD`, user-entered), `numar_document`
(supplier's invoice number, not unique), `total` (bani, persisted), `observatii`, `creat_la`.
**No `actualizat_la`**, unlike orders.

Lines: `achizitie_id` (`ON DELETE CASCADE`), `produs_id` (`ON DELETE SET NULL`), `descriere`,
`cantitate`, `unitate_masura`, `cost_unitar` (bani), `data`.

> ⚠️ **Purchases have no VAT at all** — no field on the head or the line. `achizitii.total` is a raw
> sum that never declares whether it includes VAT. Sales are tracked excluding VAT. **The two are
> therefore not comparable**, which undermines any true margin/COGS reporting. Add VAT to purchases
> in the rewrite.

Unlike orders, purchases have **no state machine** — they take effect immediately and can be deleted
at any time.

### 4.9 `fisiere` — polymorphic attachments

`nume` (original filename, displayed), `cale` (path **relative** to the attachments folder, shape
`<tip>/<id>/<uuid>.<ext>`), `tip` (extension), `marime` (bytes), `entitate_tip`, `entitate_id`, `creat_la`.

Attachable to exactly five entity types: `produs`, `client`, `furnizor`, `comanda`, `achizitie`.
**There is no foreign key** — the link is logical, via the two columns. Cleanup on entity deletion is
explicit, in the IPC layer (`src/main/ipc-entities.ts`), *after* the entity delete succeeds.

> ⚠️ Because cleanup lives in the IPC layer rather than the repository, **any other deletion path
> leaves orphaned attachments.** In the rewrite, put this in the deletion transaction itself.

### 4.10 `facturi` — invoices

**Dead schema.** See §12.

### 4.11 Foreign keys at a glance

| Relationship | On delete | User-visible effect |
|---|---|---|
| `comenzi.client_id → clienti` | RESTRICT | "cannot delete a customer with orders" |
| `achizitii.furnizor_id → furnizori` | RESTRICT | "cannot delete a supplier with purchases" |
| `produse.furnizor_id → furnizori` | SET NULL | product silently loses its supplier |
| `linii_comanda.produs_id → produse` | SET NULL | line survives as free text, keeps its prices |
| `linii_achizitie.produs_id → produse` | SET NULL | same |
| `linii_comanda.comanda_id → comenzi` | CASCADE | |
| `linii_achizitie.achizitie_id → achizitii` | CASCADE | |
| `plati.comanda_id → comenzi` | CASCADE | |
| `fisiere` → anything | *(none)* | handled in application code |

---

## 5. The order lifecycle (the core state machine)

One record moves through three states. **Every transition is one-way.**

```
                    ┌──────────────────────────────────────┐
                    │              OFERTĂ                  │  created here, always
                    │  (quote — no stock effect)           │  (state is hardcoded on INSERT)
                    └───────┬──────────────────────┬───────┘
       accepta / first payment                    anuleaza
                            │                      │
                            v                      │
                    ┌───────────────────┐          │
                    │     COMANDĂ       │          │
                    │  stock decreases  │          │
                    └───────┬───────────┘          │
                        anuleaza                   │
                            │                      │
                            v                      v
                    ┌──────────────────────────────────────┐
                    │            ANULATĂ (terminal)         │
                    │  stock restored only if it was COMANDĂ │
                    └──────────────────────────────────────┘
```

### Transitions

| From → To | Trigger | Writes | Stock |
|---|---|---|---|
| *(none)* → `oferta` | create | state hardcoded (`comenzi.ts:114`) | none |
| `oferta` → `comanda` | **explicit accept** | `data_acceptare = now` | **−qty per line** |
| `oferta` → `comanda` | **first payment > 0** ⚠️ | same, if `data_acceptare` was NULL | **−qty per line** |
| `oferta` → `anulata` | cancel | `data_anulare = now` | none (never deducted) |
| `comanda` → `anulata` | cancel | `data_anulare = now` | **+qty restored** |

**A payment silently accepts the quote.** Recording any positive payment against an `oferta` promotes
it to `comanda`, sets the acceptance date, *and decrements stock* — identical to explicit acceptance
(`comenzi.ts:229, 236-241`). This is a deliberate convenience (a deposit means the customer agreed)
but it is a significant hidden side effect. **Make it explicit in a rewrite.**

### What each state permits

| | `oferta` | `comanda` | `anulata` |
|---|---|---|---|
| Edit | ✅ (no stock effect) | ✅ (stock recomputed) | ❌ *"O comandă anulată nu poate fi modificată"* |
| Accept | ✅ | — (no-op) | ❌ silent no-op |
| Cancel | ✅ | ✅ | ❌ early return, preserves original date |
| Record payment | ✅ (promotes it!) | ✅ | ❌ rejected |
| **Delete** | ✅ | ❌ *"Doar ofertele pot fi șterse"* | ❌ |

Confirmed and cancelled orders are permanent history. **Deletion is restricted precisely so stock
can't be left wrong.**

**Editing a confirmed order** reverses the old lines' stock effect (+1) *before* deleting them, then
applies the new lines' effect (−1) after insert, all in one transaction (`comenzi.ts:151, 167`).
Stock always reflects current lines.

All operations run in a transaction and return the **re-read** order; if it vanished, they throw
*"Comanda nu mai există."* The client never constructs state locally.

---

### 5.1 Installation (montaj) — an orthogonal axis, not a fourth state

A rolling-shutter business sells *and fits*. Installation is tracked on a **second axis**, independent
of `stare`: an order can be confirmed-and-not-yet-fitted, confirmed-and-fitted, or cancelled
regardless of whether it was ever fitted.

**It is deliberately NOT a fourth value in `stare`.** `stare` has no CHECK constraint, so an unknown
value would not error — it would silently vanish from the seven `stare='comanda'` predicates in
`rapoarte.ts` and `dashboard.ts`, taking that order's revenue out of the annual report. Of the ~127
references to `stare`, exactly **one** (`lib/stare.ts`, a `Record<StareComanda, …>`) is caught by the
compiler; the rest are SQL string literals invisible to any type-checker. The three commercial states
are also strictly one-way, whereas an installation gets **rescheduled** — modelling a rescheduleable
event as a monotonic state machine is a category error.

**`stare_montaj` is derived in SQL** (`repos/comenzi.ts`, in `LIST_SQL`), never stored:

| Value | Condition |
|---|---|
| `nespecificat` | `stare <> 'comanda'` — **must be the first branch** |
| `montat` | `montaj_finalizat_la IS NOT NULL` |
| `neprogramat` | no `data_montaj` |
| `intarziat` | `data_montaj < date('now','localtime')` |
| `programat` | otherwise |

That first branch is load-bearing: without it a **cancelled** order with a past date would wear a red
"Întârziat" badge forever, and a quote with a pencilled-in date would read "Programat" — both
contradicting the dashboard tiles, which correctly filter on `stare='comanda'`.

**Completion is a recorded fact, not an inference.** "The date passed" does not mean "it happened" —
installations slip constantly. `montaj_finalizat_la` is written only through
`comenzi:marcheazaMontat`, guarded to `stare='comanda'`, and is deliberately **absent from the
`UPDATE` statement** in `updateComanda`, so saving an order can never erase it.

**The money for installation is an ordinary line**, fed by a seeded `Montaj` catalogue product
(`track_stock=0`, so `ajusteazaStoc` ignores it by construction). It therefore gets cost, price, its
own VAT rate, margin, a row on the PDF, and inclusion in every report **with no new code** — and the
"persisted totals == sum of lines" invariant is preserved. A `pret_montaj` column would have been
erased silently on the next save, because `updateComanda` recomputes totals wholly from the lines.

> ⚠️ Keep the `Montaj` product at `track_stock=0`. Because it will appear on nearly every order, it
> is the row most exposed to gap 2 in §13: ticking that box would make every accept/cancel cycle
> fabricate stock.

## 6. Feature inventory

### 6.1 Base records — Products, Customers, Suppliers
Straight CRUD with a right-hand drawer form, client-side text filter, SQL-side sorting, and
attachments. Deletion guards as per §4.11.

### 6.2 Orders & quotes
The §5 state machine, plus line editing with **live totals and per-line profit** computed in the
browser from the same `shared/calc.ts` the backend uses to persist them — one source of truth.

### 6.3 Payments
Ledger of receipts with a denormalised total. UI blocks amounts ≤ 0 and asks for confirmation when
paying more than the outstanding balance.

### 6.4 Purchases & stock
Purchases are the **only mechanism that increases stock** and the only source of `ultim_cost`.
Immediate effect; edit reverses then re-applies; delete reverses.

Stock is **opt-in per product** (`track_stock`). Stock movement is filtered by
`WHERE ... AND track_stock = 1` evaluated **at the moment of each operation** — see the critical
warning in §13.

### 6.5 Documents (PDF)
Two documents: **order/quote** and **annual report**. Both offer *preview* (renders to a temp file
and opens it in a viewer window) and *save*. Both paths share one HTML source, so they cannot drift.

The order PDF shows: company header from settings (logo embedded as a data-URI), buyer block, line
table (#, description, qty, unit, price excl. VAT, VAT %, value), totals, plus "paid"/"outstanding"
rows for non-quotes, plus notes. **It never shows cost, margin, or profit** — it is customer-facing.

### 6.6 Reports
Annual aggregation: monthly sales+profit bar chart, profit by customer (top 20), purchases by
supplier (top 20), outstanding receivables.

**Year filter:** orders fall in the year of `COALESCE(data_acceptare, data_creare)`; purchases by
their user-entered `data`. **Only `stare='comanda'` is included** — quotes and cancelled orders are
excluded entirely.

### 6.7 Dashboard
Six tiles (outstanding, active orders, pending quotes, current-month profit, low stock, and a
hardcoded disabled ANAF tile) plus a recent-activity feed merging the last 6 orders and 6 purchases,
trimmed to 8. **Titles and navigation links are built in the backend**, not the UI.

### 6.8 Global search
One header box searching products (name only), customers (name/CUI/CNP), suppliers (name/CUI), and
orders (number + customer name). `LIKE '%term%'`, 2-character minimum, 180 ms debounce, 6 results
per type. **Purchases are not searchable**, though the type exists. Each result carries a
backend-built navigation link.

### 6.9 Settings, backup, attachments, auto-update
Settings as described in §4.1. Backup copies the database plus the attachments folder; restore
validates the backup, snapshots current data as a safety net, then swaps. Attachments are copied
into app storage under a UUID filename.

---

## 7. The linkage map

**This is the most important section.** Everything here is a place where one feature changes another
feature's data.

### 7.1 Stock — the busiest linkage

| Trigger | Effect on `produse.stoc_curent` | Condition |
|---|---|---|
| Purchase created | **+qty** per line | `produs_id != NULL` AND `track_stock = 1` |
| Purchase edited | reverse old (−), apply new (+) | one transaction |
| Purchase deleted | reverse (−) | always allowed |
| Order **accepted** | **−qty** per line | only from `oferta`; idempotent |
| **First payment on a quote** | **−qty** per line | promotes to `comanda` |
| Order **cancelled** | **+qty** restored | only if it was `comanda` |
| Confirmed order **edited** | reverse old (+), apply new (−) | only while `stare='comanda'` |
| Product saved | **absolute overwrite** ⚠️ | from the form field |

### 7.2 Cost and price propagation

```
  linii_achizitie.cost_unitar ──derived──> produs.ultim_cost  (last purchase, by data DESC, id DESC)
                                                │
  produs.cost_referinta ──────────┬─────────────┘
       (manual, preferred)        │  fallback
                                  v
                    order line "Cost" box  ← prefilled only if empty/zero
  produs.pret_referinta ─────> order line "Preț" box  ← prefilled only if empty/zero
```

Prefill happens **in the browser, only on manual product selection** (`ComandaEditor.tsx:184-190`).
A later purchase does **not** update already-saved orders — correct, since lines are snapshots.

> ⚠️ **A purchase never writes back to `produse.cost_referinta` or `pret_referinta`.** Once a product
> has a manual `cost_referinta`, real purchase costs are ignored for prefill forever. Consider
> surfacing "last paid cost differs from the reference cost" in the rewrite.

### 7.3 Settings → the rest of the app

| Setting | Consumers |
|---|---|
| `cota_tva_implicita` | new product default; new order line default; VAT select fallback |
| `prag_stoc_implicit` | dashboard low-stock count **(SQL)** and product badge **(browser)** — same rule implemented twice, with different fallbacks |
| company details + `logo_path` | order PDF header only — **not** the report PDF |
| `backup_folder`, `auto_backup` | backup-on-quit |
| `versiune_ignorata` | updater; deliberately stripped from the settings-save payload so saving settings can't undo a "skip this version" choice |

### 7.4 Deletion cascade behaviour

| Delete | Blocked by | Side effects |
|---|---|---|
| Customer | any order exists | — |
| Supplier | any purchase exists | products lose `furnizor_id` silently |
| Product | **nothing** ⚠️ | order and purchase lines keep prices, become free text |
| Order | not a quote | lines + payments cascade; attachments cleaned in IPC layer |
| Purchase | nothing | stock reversed; lines cascade |

### 7.5 Navigation links

| From | To | Mechanism |
|---|---|---|
| Global search → product/customer/supplier | list screen | `?edit=<id>` deep link, opens the drawer |
| Global search → order | `/comenzi/<id>` | direct route |
| Dashboard activity row | order/purchase editor | link string built in the **backend** |
| Dashboard tiles | `/comenzi`, `/produse`, `/rapoarte` | ⚠️ **no filter passed** — context is lost on arrival |

### 7.6 Reporting inputs

- Sales & profit ← `comenzi` + `linii_comanda`, **`stare='comanda'` only**, by `COALESCE(data_acceptare, data_creare)`.
- Purchases by supplier ← `achizitii.total`, by `achizitii.data`.
- Receivables ← `total − achitat` where `stare='comanda'`. ⚠️ **No year filter** despite living in a
  document titled "Raport `<year>`".

---

## 8. Derived values: what is computed, and where

**Only three values are denormalised:** `comenzi.total_*`, `comenzi.achitat`, `achizitii.total`.
All three are reconstructible from their children. Everything else is computed on read.

### The canonical formulas — `shared/calc.ts`

```
per line:  net    = round(cantitate × pret_unitar)
           tva    = round(net × cota_tva / 100)
           total  = net + tva
           cost   = round(cantitate × cost_unitar)
           profit = net − cost            // VAT is neutral to profit

per order: sum each line's already-rounded values
```

Rounding happens **per line, then sums** — deliberate, and covered by tests. This same module is used
by the backend (to persist totals), the browser (live preview), and the PDF generator.

> ### ⚠️ Profit has two different implementations
>
> | Where | Formula | Rounding |
> |---|---|---|
> | `shared/calc.ts:24` | `Σ (round(qty×price) − round(qty×cost))` | **per line** |
> | SQL — order list, dashboard, reports | `round(Σ (price − cost) × qty)` | **at the end** |
>
> Identical for whole quantities; they can differ by a few bani for fractional quantities (m², linear
> metres) — exactly the units this business uses. **Pick one formula in the rewrite.** The SQL
> version also ignores order state in the order list, computing profit even for quotes and cancelled
> orders.

### Other derived values

| Value | Source | Computed in |
|---|---|---|
| `rest_de_plata` | `total − achitat` | SQL |
| `ultim_cost` | last purchase line cost | SQL subquery, per row |
| `stoc scăzut` | `stoc_curent <= COALESCE(prag_stoc, default)` | SQL **and** browser (duplicated) |
| `stare_montaj` | see §5.1 | SQL, in `LIST_SQL` |
| `marjaProcent` | `(price − cost) / price × 100` | browser only, display feedback |
| `client_nume`, `furnizor_nume`, `nr_linii` | JOINs / COUNT subqueries | SQL |
| activity `titlu` / `link` | string building | **backend JS** |

---

## 9. Validation rules

All IPC input is re-validated in the backend — `src/main/db/validate.ts` is the single trust boundary.
Messages are Romanian and surface directly in UI notifications.

| Rule | Enforced |
|---|---|
| Product/customer/supplier name non-empty | main + UI |
| VAT rate 0–100 | main |
| Money values ≥ 0 | main (**but not integer-checked**) |
| Quantity **> 0 strictly** | main |
| Line identifiable (description **or** product) | main |
| Order has ≥ 1 line | main + UI |
| Purchase date matches `YYYY-MM-DD` | main |
| Order number uniqueness | main only (user-entered numbers only) |
| Cancelled order immutable | main only |
| Only quotes deletable | main only |
| Customer/supplier deletion guards | main only |
| Company vs individual field coherence | **UI only** ⚠️ |
| Payment > 0 | **UI only** ⚠️ |
| **Settings** | **not validated anywhere** ⚠️ |
| **Unit of measure** | not validated — silently coerced to `buc` |

---

## 10. The API surface (IPC) as a contract

Request/response calls between UI and backend. Reimplement as REST/RPC endpoints; the shapes map
directly. Full typed definition: `shared/types.ts` (`CatastifApi`).

```
app:getVersion                        → string

setari:get                            → Setari
setari:save(patch: Partial<Setari>)   → Setari

furnizori | clienti | produse:
  :list                               → T[]
  :get(id)                            → T | undefined
  :create(TInput)                     → T
  :update(id, TInput)                 → T
  :delete(id)                         → void      // also purges attachments

comenzi:
  :list(stare?)                       → ComandaCuExtra[]   // the only server-side filter in the app
  :get(id)                            → ComandaDetaliu | undefined
  :create(ComandaInput)               → ComandaDetaliu
  :update(id, ComandaInput)           → ComandaDetaliu
  :accepta(id)                        → ComandaDetaliu     // + stock decrement
  :anuleaza(id)                       → ComandaDetaliu     // + stock restore
  :plata(id, suma /* BANI */)         → ComandaDetaliu     // may promote the quote
  :delete(id)                         → void               // quotes only

achizitii:  :list :get :create :update :delete             // stock effects on all writes

dashboard:get                         → DashboardData
search:global(q)                      → SearchResult[]     // [] if q.trim().length < 2
rapoarte:get(an)                      → RaportData

fisiere:    :list(tip,id) :attach(tip,id) :open(id) :delete(id)
export:tabel(format, name, headers[], rows[][])            // pre-formatted by the UI
pdf:        :comanda(id) :raport(an) :previzualizeazaComanda(id) :previzualizeazaRaport(an)
backup:     :exportNow :importFrom :chooseFolder :openFolder
```

**Every order mutation returns the fully re-read order.** The UI never patches state locally — a good
pattern to keep.

---

## 11. Screen inventory

| Route | Screen | Notes |
|---|---|---|
| `/` | Dashboard | 6 tiles + activity feed |
| `/produse` | Products | drawer edit, `?edit=<id>` deep link |
| `/clienti` | Customers | same |
| `/furnizori` | Suppliers | same |
| `/comenzi` | Order list | segmented state filter (**server-side**, not in the URL) |
| `/comenzi/:id` | Order editor | `:id = 'nou'` means create |
| `/achizitii` | Purchase list | |
| `/achizitii/:id` | Purchase editor | `'nou'` = create |
| `/facturi` | Invoices | **static placeholder** |
| `/rapoarte` | Reports | chart + 3 tables + export + PDF |
| `/setari` | Settings | 4 sections |

**Consistent list pattern:** error (with retry) → loading skeleton → empty state → table. Filtering is
always client-side over the full fetched list (Unicode-aware); sorting is always SQL-side and not
user-changeable. **There is no pagination anywhere** — every list loads all rows. Fine for a small
business locally; **you will need pagination on the web.**

Each route remount refetches — there is no global cache. Only `useSetari` caches, at module level,
invalidated explicitly after a settings save.

---

## 12. What is NOT implemented

**Invoicing / e-Factura does not exist.** Be unambiguous about this.

**What exists:** the `facturi` table (v1 schema), the dead `comenzi.factura_id` column, the
TypeScript types `Factura` and `StareAnaf`, the settings `serie_factura` / `numar_factura_curent`
(editable but read by nothing), a static "coming soon" screen, and a disabled dashboard tile.

**What does not exist:** no invoice repository, no IPC channels, no API methods, no XML generation,
no numbering, no order→invoice link. Nothing has ever written to that table.

> ⚠️ **The order PDF is not an invoice.** It has no invoice series/number, no due date, no fiscal
> mentions, and is literally titled "COMANDĂ"/"OFERTĂ".

**Intended design** (stated in the UI): generate RO_CIUS / UBL 2.1 XML for the Romanian ANAF
e-Factura system later; the app **must never handle the user's ANAF credentials**. The fiscal fields
already collected (company CUI/Reg. Com./address/IBAN; customer CUI/CNP/address) exist for this.

**Also absent (montaj):** one installation per order — no second address, no multi-day fitting, no
warranty revisit; no installer/team assignment (who goes is written in `detalii_montaj`); no
reschedule history (the date is overwritten); no calendar view; and **no gate** blocking final
payment or invoicing until installation is marked done. That last one is a genuine open question —
see the note at the end of §13.

**Also absent:** multi-currency (`moneda` defaults to `'RON'` and is never used), any user/permission
model, any audit trail, any stock-movement journal, supplier returns or credit notes, and pagination.

---

## 13. Known gaps — fix these in the rewrite

From a 100-agent audit in which every finding was adversarially verified; 65 survived. The ones that
matter for a rewrite:

### Critical — stock integrity

1. **Stock can go negative, silently.** Accepting an order never checks availability; the update is
   pure arithmetic with no floor and no pre-check. Ironically, validation *rejects* a negative
   `stoc_curent` typed into the product form, while the automatic path creates them freely.
   → *Check availability at the single point where sales decrement stock, and decide the policy
   explicitly (block, or allow with a warning).*

2. **Toggling `track_stock` fabricates or destroys stock.** The `WHERE track_stock = 1` condition is
   evaluated at the moment of *each* operation, and nothing records whether a document actually moved
   stock. Turn tracking on between accepting and cancelling an order and the cancel credits stock
   that was never debited. Turning it off also forces `stoc_curent` to 0, losing the value.
   → **Root cause: the stock effect is *recomputed* on reversal instead of *recorded* on application.**
   *Write a stock-movement journal (document type, id, product, qty, timestamp) and reverse from it.
   This single change fixes gaps 1–3 and gives you an audit trail.*

3. **Reversal ignores the state at document time** — the same root cause, permanent drift.

### High

4. **Deleting a product is completely unguarded**, unlike customers and suppliers. Lines survive as
   free text but the cost history link is severed forever. → *Guard it, or soft-delete.*
5. **Product save overwrites `stoc_curent` absolutely**, discarding concurrent movements.
6. **Negative payment corrections are modelled and supported by the backend but impossible from the
   UI** (`min={0}` plus a guard). The feature exists and is unreachable.
7. **Cancelling an order keeps the money received but hides it from every report** — there is no
   refund concept. Cash physically received vanishes from the books.
8. **Purchases never enter profit** — no COGS reconciliation. "Profit" is per-line margin only.
9. **The report PDF has no company header** — the order PDF does. It looks unbranded.
10. **Auto-generated order numbers can collide** with manually entered ones.
11. **No unsaved-changes guard** on Settings, on the product/customer/supplier drawers, or on window
    close — only the two full-page editors have it.

### Medium — worth knowing

12. **"De încasat" in the annual report ignores the year filter** (the UI title admits it).
13. **Export is truncated at 20 rows silently** (the SQL `LIMIT 20` flows into the export).
14. **Export exists only on Reports** — no entity list can be exported.
15. **Dates are written in UTC and displayed as local time** — near midnight, a record can show the
    wrong day.
16. **`logo_path` is read by the PDF generator but cannot be set anywhere in the UI** — dead feature.
17. **Global search misses uppercase diacritics** and searches different fields than the per-screen
    filters; **purchases are not searched at all**.
18. **Dashboard tiles navigate without passing their filter**, so the context is lost.
19. **Units have no conversion factors** — you cannot buy in `ml` and sell in `buc`; stock adds up
    quantitatively regardless of unit, with no guard.
20. **Settings are not validated at all** server-side.

### One open question for the owner

The brief said *"they need a montaj phase, and then if everything is okay, they go on."* That **may**
mean a gate: final payment (and later, invoicing) blocked until installation is marked complete. No
gate was built, because any such rule re-couples installation to the commercial axis and erodes the
independence the whole design rests on. If a gate is wanted, the gentle version — a warning beside
the payment box when installation isn't marked done, with no hard block — sits on top of the existing
predicate and needs no schema change.

---

## 14. Design decisions worth keeping

Not everything needs changing. These are genuinely good and should survive the rewrite:

1. **Cost and price on every line.** The entire value proposition. Profit is knowable at every level.
2. **Integer money.** No floating-point currency bugs. Keep it — just validate integrality.
3. **One shared calculation module** used by backend, UI, and PDF generation. Single source of truth
   for money maths.
4. **Line items are snapshots.** Changing a product never rewrites history.
5. **Mutations return the re-read entity.** The client never guesses at state.
6. **Deletion guards with human-readable messages**, backed by database constraints — belt and braces.
7. **Confirmed orders cannot be deleted.** History is permanent; stock stays honest.
8. **A quote and an order are the same record**, not two. The lifecycle is a state field, and the
   document reflects it. Much simpler than a quote→order conversion.
9. **Optional per-product stock.** Not every product needs inventory; forcing it would be noise.
10. **Validation at the trust boundary**, in the language of the user, surfacing directly in the UI.
11. **Preview and save share one document source** — they cannot drift apart.
12. **The schema is versioned and migrations are data-preserving**, each in its own transaction.

---

## Appendix — where to look in the code

| Concern | File |
|---|---|
| Complete schema, all versions | `src/main/db/migrations.ts` |
| Money/VAT/profit formulas | `shared/calc.ts` |
| All TypeScript types + API contract | `shared/types.ts` |
| Units of measure | `shared/um.ts` |
| Validation (trust boundary) | `src/main/db/validate.ts` |
| Order lifecycle + payments | `src/main/db/repos/comenzi.ts` |
| Purchases + stock | `src/main/db/repos/achizitii.ts`, `stoc.ts` |
| Report aggregations (SQL) | `src/main/db/repos/rapoarte.ts` |
| Dashboard queries | `src/main/db/repos/dashboard.ts` |
| PDF templates | `src/main/pdf.ts` |
| Screens | `src/renderer/src/routes/` |
| Tests (executable spec) | `tests/` |

The test suite is the most reliable behavioural documentation — particularly `tests/comenzi.test.ts`
for the state machine and stock, and `tests/calc.test.ts` for rounding.
