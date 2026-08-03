// Tipuri partajate între procesul principal (main) și interfață (renderer).
// IMPORTANT: toate valorile monetare sunt stocate în BANI (întreg = lei × 100).

export type TipClient = 'firma' | 'persoana'
export type StareComanda = 'oferta' | 'comanda' | 'anulata'
export type EntitateTip = 'produs' | 'client' | 'furnizor' | 'comanda' | 'achizitie'
export type StareAnaf = 'placeholder' | 'de_trimis' | 'trimisa' | 'validata' | 'respinsa'

// ---------------------------------------------------------------------------
// Setări (stocate ca pereche cheie/valoare; aici expunem forma tipată)
// ---------------------------------------------------------------------------
export interface Setari {
  nume_firma: string
  cui: string
  nr_reg_com: string
  adresa: string
  judet: string
  oras: string
  cod_postal: string
  iban: string
  telefon: string
  email: string
  logo_path: string | null
  cota_tva_implicita: number // ex. 21
  serie_factura: string
  numar_factura_curent: number
  backup_folder: string | null
  auto_backup: boolean
  prag_stoc_implicit: number
  versiune_ignorata: string | null
}

// ---------------------------------------------------------------------------
// Entități
// ---------------------------------------------------------------------------
export interface Furnizor {
  id: number
  nume: string
  cui: string | null
  nr_reg_com: string | null
  adresa: string | null
  telefon: string | null
  email: string | null
  note: string | null
  creat_la: string
  actualizat_la: string
}
export type FurnizorInput = Omit<Furnizor, 'id' | 'creat_la' | 'actualizat_la'>

export interface Produs {
  id: number
  nume: string
  descriere: string | null
  unitate_masura: string
  pret_referinta: number | null // bani
  cota_tva: number
  track_stock: boolean
  stoc_curent: number
  prag_stoc: number | null
  furnizor_id: number | null
  ultim_cost: number | null // bani — cel mai recent cost de achiziție (calculat)
  creat_la: string
  actualizat_la: string
}
export type ProdusInput = Omit<Produs, 'id' | 'creat_la' | 'actualizat_la' | 'ultim_cost'>

export interface Client {
  id: number
  tip: TipClient
  nume: string
  cui: string | null
  nr_reg_com: string | null
  cnp: string | null
  adresa: string | null
  judet: string | null
  oras: string | null
  cod_postal: string | null
  telefon: string | null
  email: string | null
  note: string | null
  creat_la: string
  actualizat_la: string
}
export type ClientInput = Omit<Client, 'id' | 'creat_la' | 'actualizat_la'>

export interface LinieComanda {
  id: number
  comanda_id: number
  produs_id: number | null
  descriere: string
  cantitate: number
  unitate_masura: string
  cost_unitar: number // bani
  pret_unitar: number // bani
  cota_tva: number
  pozitie: number
}
export type LinieComandaInput = Omit<LinieComanda, 'id' | 'comanda_id'>

export interface Comanda {
  id: number
  numar: string | null
  client_id: number | null
  stare: StareComanda
  data_creare: string
  data_acceptare: string | null
  data_anulare: string | null
  total_fara_tva: number // bani
  total_tva: number
  total: number
  achitat: number
  observatii: string | null
  factura_id: number | null
  creat_la: string
  actualizat_la: string
}

// Comandă cu informații derivate pentru afișare în liste
export interface ComandaCuExtra extends Comanda {
  client_nume: string | null
  rest_de_plata: number // bani (total - achitat)
  profit: number // bani
}

export interface Plata {
  id: number
  comanda_id: number
  suma: number // bani (negativ = corecție)
  data: string
  creat_la: string
}

export interface ComandaDetaliu extends ComandaCuExtra {
  linii: LinieComanda[]
  plati: Plata[]
}

// Date pentru creare/actualizare comandă (starea și plățile se gestionează separat).
export interface ComandaInput {
  numar: string | null
  client_id: number | null
  observatii: string | null
  linii: LinieComandaInput[]
}

export interface LinieAchizitie {
  id: number
  achizitie_id: number
  produs_id: number | null
  descriere: string
  cantitate: number
  unitate_masura: string
  cost_unitar: number // bani
  data: string
}
export type LinieAchizitieInput = Omit<LinieAchizitie, 'id' | 'achizitie_id'>

export interface Achizitie {
  id: number
  furnizor_id: number | null
  data: string
  numar_document: string | null
  total: number // bani
  observatii: string | null
  creat_la: string
}

export interface AchizitieCuExtra extends Achizitie {
  furnizor_nume: string | null
  nr_linii: number
}

export interface AchizitieDetaliu extends AchizitieCuExtra {
  linii: LinieAchizitie[]
}

export interface AchizitieInput {
  furnizor_id: number | null
  data: string
  numar_document: string | null
  observatii: string | null
  linii: LinieAchizitieInput[]
}

export interface Factura {
  id: number
  serie: string | null
  numar: number | null
  comanda_id: number | null
  client_id: number | null
  data_emitere: string | null
  data_scadenta: string | null
  total_fara_tva: number
  total_tva: number
  total: number
  moneda: string
  stare_anaf: StareAnaf
  xml_path: string | null
  creat_la: string
}

export interface Fisier {
  id: number
  nume: string
  cale: string
  tip: string | null
  marime: number | null
  entitate_tip: EntitateTip
  entitate_id: number
  creat_la: string
}

// ---------------------------------------------------------------------------
// Rezultate operațiuni
// ---------------------------------------------------------------------------
export interface BackupResult {
  ok: boolean
  cale?: string
  mesaj?: string
}

export interface ActivitateItem {
  tip: string // oferta | comanda | anulata | achizitie
  titlu: string
  data: string
  suma: number | null // bani
  link: string
}

export interface DashboardData {
  oferte_in_asteptare: number
  comenzi_active: number
  de_incasat: number // bani
  profit_luna: number // bani
  stoc_scazut: number
  activitate: ActivitateItem[]
}

export interface SearchResult {
  tip: EntitateTip
  id: number
  titlu: string
  subtitlu: string | null
  link: string
}

// --- Rapoarte ---
export interface RaportLunar {
  luna: string // '01'..'12'
  total_fara_tva: number // bani
  profit: number // bani
}
export interface RaportClient {
  client: string
  total: number // bani
  profit: number // bani
}
export interface RaportFurnizor {
  furnizor: string
  total: number // bani
}
export interface RaportIncasare {
  id: number
  numar: string | null
  client: string | null
  total: number
  achitat: number
  rest: number
}
export interface RaportData {
  an: number
  ani: number[]
  vanzari_lunare: RaportLunar[]
  profit_pe_client: RaportClient[]
  achizitii_pe_furnizor: RaportFurnizor[]
  de_incasat: RaportIncasare[]
}

export type ExportFormat = 'csv' | 'xlsx'

// Starea fluxului de actualizare, trimisă din main către interfață. Interfața
// nu ține minte nimic: la montare cere starea curentă (`update.state()`), apoi
// ascultă schimbările. Așa un renderer care pornește mai încet decât prima
// verificare nu pierde anunțul.
export type StareActualizare =
  | { faza: 'inactiv' }
  | { faza: 'verificare' }
  | { faza: 'disponibila'; versiune: string }
  | { faza: 'descarcare'; versiune: string; procent: number }
  | { faza: 'descarcata'; versiune: string }
  | { faza: 'la_zi' }
  | { faza: 'eroare'; mesaj: string }

// Faza este trecătoare (fereastra o „consumă” închizându-se), dar două fapte
// trebuie să rămână vizibile în Setări oricât de mult după: ce versiune a fost
// pusă deoparte și dacă există una descărcată, gata de instalat. Amândouă sunt
// ținute în procesul principal — interfața nu le mai ghicește din formular.
export interface InfoActualizare {
  stare: StareActualizare
  versiuneIgnorata: string | null
  versiuneDescarcata: string | null
}

// ---------------------------------------------------------------------------
// Suprafața API expusă în renderer prin preload (window.api)
// Crește pe parcursul etapelor de dezvoltare.
// ---------------------------------------------------------------------------
export interface CatastifApi {
  app: {
    getVersion(): Promise<string>
  }
  setari: {
    get(): Promise<Setari>
    save(patch: Partial<Setari>): Promise<Setari>
  }
  backup: {
    exportNow(): Promise<BackupResult>
    importFrom(): Promise<BackupResult>
    chooseFolder(): Promise<string | null>
    openFolder(): Promise<void>
  }
  furnizori: {
    list(): Promise<Furnizor[]>
    get(id: number): Promise<Furnizor | undefined>
    create(input: FurnizorInput): Promise<Furnizor>
    update(id: number, input: FurnizorInput): Promise<Furnizor>
    delete(id: number): Promise<void>
  }
  clienti: {
    list(): Promise<Client[]>
    get(id: number): Promise<Client | undefined>
    create(input: ClientInput): Promise<Client>
    update(id: number, input: ClientInput): Promise<Client>
    delete(id: number): Promise<void>
  }
  produse: {
    list(): Promise<Produs[]>
    get(id: number): Promise<Produs | undefined>
    create(input: ProdusInput): Promise<Produs>
    update(id: number, input: ProdusInput): Promise<Produs>
    delete(id: number): Promise<void>
  }
  comenzi: {
    list(stare?: StareComanda): Promise<ComandaCuExtra[]>
    get(id: number): Promise<ComandaDetaliu | undefined>
    create(input: ComandaInput): Promise<ComandaDetaliu>
    update(id: number, input: ComandaInput): Promise<ComandaDetaliu>
    accepta(id: number): Promise<ComandaDetaliu>
    anuleaza(id: number): Promise<ComandaDetaliu>
    plata(id: number, suma: number): Promise<ComandaDetaliu>
    delete(id: number): Promise<void>
  }
  achizitii: {
    list(): Promise<AchizitieCuExtra[]>
    get(id: number): Promise<AchizitieDetaliu | undefined>
    create(input: AchizitieInput): Promise<AchizitieDetaliu>
    update(id: number, input: AchizitieInput): Promise<AchizitieDetaliu>
    delete(id: number): Promise<void>
  }
  dashboard: {
    get(): Promise<DashboardData>
  }
  search: {
    global(q: string): Promise<SearchResult[]>
  }
  fisiere: {
    list(entitateTip: EntitateTip, entitateId: number): Promise<Fisier[]>
    attach(entitateTip: EntitateTip, entitateId: number): Promise<Fisier[]>
    open(id: number): Promise<void>
    delete(id: number): Promise<void>
  }
  rapoarte: {
    get(an: number): Promise<RaportData>
  }
  export: {
    tabel(
      format: ExportFormat,
      numeFisier: string,
      headers: string[],
      rows: (string | number)[][]
    ): Promise<BackupResult>
  }
  pdf: {
    comanda(id: number): Promise<BackupResult>
    raport(an: number): Promise<BackupResult>
  }
  update: {
    // Starea curentă, cerută la montarea interfeței (nu pierde anunțuri timpurii).
    state(): Promise<InfoActualizare>
    onState(cb: (info: InfoActualizare) => void): () => void
    // Verificare pornită manual din Setări.
    check(): Promise<void>
    // Răspunsul la „Actualizare disponibilă”: descarcă / mai târziu / sari peste.
    respond(raspuns: 'da' | 'nu' | 'skip'): Promise<void>
    // Oprește o descărcare în curs (de exemplu una blocată).
    cancel(): Promise<void>
    // După ce descărcarea s-a terminat: repornește acum sau la următoarea închidere.
    install(cand: 'acum' | 'la_inchidere'): Promise<void>
    // Anulează un „Nu pentru această versiune” dat din greșeală.
    clearSkipped(): Promise<void>
  }
}
