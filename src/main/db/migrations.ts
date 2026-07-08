// Migrații versionate. Rulează în ordine; `user_version` din SQLite ține evidența.
// Tot schema trăiește aici (inline) ca să funcționeze identic în dezvoltare și în
// aplicația împachetată (fără a depinde de fișiere .sql pe disc).
//
// Valorile monetare se stochează în BANI (întreg). Cantitățile / cotele TVA sunt REAL.

export interface Migration {
  version: number
  nume: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    nume: 'init',
    sql: /* sql */ `
      CREATE TABLE IF NOT EXISTS setari (
        cheie   TEXT PRIMARY KEY,
        valoare TEXT
      );

      CREATE TABLE IF NOT EXISTS furnizori (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        nume          TEXT NOT NULL,
        cui           TEXT,
        nr_reg_com    TEXT,
        adresa        TEXT,
        telefon       TEXT,
        email         TEXT,
        note          TEXT,
        creat_la      TEXT NOT NULL DEFAULT (datetime('now')),
        actualizat_la TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS produse (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        nume           TEXT NOT NULL,
        descriere      TEXT,
        unitate_masura TEXT NOT NULL DEFAULT 'buc',
        pret_referinta INTEGER,
        cota_tva       REAL NOT NULL DEFAULT 21,
        track_stock    INTEGER NOT NULL DEFAULT 0,
        stoc_curent    REAL NOT NULL DEFAULT 0,
        prag_stoc      REAL,
        furnizor_id    INTEGER REFERENCES furnizori(id) ON DELETE SET NULL,
        creat_la       TEXT NOT NULL DEFAULT (datetime('now')),
        actualizat_la  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS clienti (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        tip           TEXT NOT NULL DEFAULT 'persoana',
        nume          TEXT NOT NULL,
        cui           TEXT,
        nr_reg_com    TEXT,
        cnp           TEXT,
        adresa        TEXT,
        judet         TEXT,
        oras          TEXT,
        cod_postal    TEXT,
        telefon       TEXT,
        email         TEXT,
        note          TEXT,
        creat_la      TEXT NOT NULL DEFAULT (datetime('now')),
        actualizat_la TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS comenzi (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        numar          TEXT,
        client_id      INTEGER REFERENCES clienti(id) ON DELETE RESTRICT,
        stare          TEXT NOT NULL DEFAULT 'oferta',
        data_creare    TEXT NOT NULL DEFAULT (datetime('now')),
        data_acceptare TEXT,
        data_anulare   TEXT,
        total_fara_tva INTEGER NOT NULL DEFAULT 0,
        total_tva      INTEGER NOT NULL DEFAULT 0,
        total          INTEGER NOT NULL DEFAULT 0,
        achitat        INTEGER NOT NULL DEFAULT 0,
        observatii     TEXT,
        factura_id     INTEGER,
        creat_la       TEXT NOT NULL DEFAULT (datetime('now')),
        actualizat_la  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS linii_comanda (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        comanda_id     INTEGER NOT NULL REFERENCES comenzi(id) ON DELETE CASCADE,
        produs_id      INTEGER REFERENCES produse(id) ON DELETE SET NULL,
        descriere      TEXT NOT NULL DEFAULT '',
        cantitate      REAL NOT NULL DEFAULT 1,
        unitate_masura TEXT NOT NULL DEFAULT 'buc',
        cost_unitar    INTEGER NOT NULL DEFAULT 0,
        pret_unitar    INTEGER NOT NULL DEFAULT 0,
        cota_tva       REAL NOT NULL DEFAULT 21,
        pozitie        INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS achizitii (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        furnizor_id    INTEGER REFERENCES furnizori(id) ON DELETE RESTRICT,
        data           TEXT NOT NULL DEFAULT (date('now')),
        numar_document TEXT,
        total          INTEGER NOT NULL DEFAULT 0,
        observatii     TEXT,
        creat_la       TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS linii_achizitie (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        achizitie_id   INTEGER NOT NULL REFERENCES achizitii(id) ON DELETE CASCADE,
        produs_id      INTEGER REFERENCES produse(id) ON DELETE SET NULL,
        descriere      TEXT NOT NULL DEFAULT '',
        cantitate      REAL NOT NULL DEFAULT 1,
        unitate_masura TEXT NOT NULL DEFAULT 'buc',
        cost_unitar    INTEGER NOT NULL DEFAULT 0,
        data           TEXT NOT NULL DEFAULT (date('now'))
      );

      CREATE TABLE IF NOT EXISTS facturi (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        serie          TEXT,
        numar          INTEGER,
        comanda_id     INTEGER REFERENCES comenzi(id) ON DELETE SET NULL,
        client_id      INTEGER REFERENCES clienti(id) ON DELETE RESTRICT,
        data_emitere   TEXT,
        data_scadenta  TEXT,
        total_fara_tva INTEGER NOT NULL DEFAULT 0,
        total_tva      INTEGER NOT NULL DEFAULT 0,
        total          INTEGER NOT NULL DEFAULT 0,
        moneda         TEXT NOT NULL DEFAULT 'RON',
        stare_anaf     TEXT NOT NULL DEFAULT 'placeholder',
        xml_path       TEXT,
        creat_la       TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS fisiere (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        nume         TEXT NOT NULL,
        cale         TEXT NOT NULL,
        tip          TEXT,
        marime       INTEGER,
        entitate_tip TEXT NOT NULL,
        entitate_id  INTEGER NOT NULL,
        creat_la     TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_produse_furnizor ON produse(furnizor_id);
      CREATE INDEX IF NOT EXISTS idx_comenzi_client   ON comenzi(client_id);
      CREATE INDEX IF NOT EXISTS idx_comenzi_stare    ON comenzi(stare);
      CREATE INDEX IF NOT EXISTS idx_linii_comanda    ON linii_comanda(comanda_id);
      CREATE INDEX IF NOT EXISTS idx_achizitii_furn   ON achizitii(furnizor_id);
      CREATE INDEX IF NOT EXISTS idx_linii_achizitie  ON linii_achizitie(achizitie_id);
      CREATE INDEX IF NOT EXISTS idx_fisiere_entitate ON fisiere(entitate_tip, entitate_id);
    `
  },
  {
    version: 2,
    nume: 'plati_si_indecsi',
    sql: /* sql */ `
      -- Istoric de plăți pe comandă. comenzi.achitat rămâne totalul denormalizat,
      -- actualizat în aceeași tranzacție cu inserarea plății.
      CREATE TABLE IF NOT EXISTS plati (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        comanda_id INTEGER NOT NULL REFERENCES comenzi(id) ON DELETE CASCADE,
        suma       INTEGER NOT NULL,
        data       TEXT NOT NULL DEFAULT (datetime('now')),
        creat_la   TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_plati_comanda ON plati(comanda_id);

      -- Datele existente: totalul achitat de până acum devine o singură plată
      -- inițială, datată la acceptarea comenzii.
      INSERT INTO plati (comanda_id, suma, data)
        SELECT id, achitat, COALESCE(data_acceptare, creat_la)
        FROM comenzi WHERE achitat > 0;

      -- Indecși pentru interogările fierbinți:
      -- ultimul cost de achiziție pe produs (lista de produse),
      -- sortările după dată (liste, rapoarte pe an).
      CREATE INDEX IF NOT EXISTS idx_linii_achizitie_produs ON linii_achizitie(produs_id, data);
      CREATE INDEX IF NOT EXISTS idx_comenzi_data           ON comenzi(data_creare);
      CREATE INDEX IF NOT EXISTS idx_achizitii_data         ON achizitii(data);
    `
  }
]
