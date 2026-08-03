# Cum instalezi Catastif

Ghid pentru **Windows 10 și Windows 11**. Nu ai nevoie de cunoștințe tehnice, nu trebuie să scrii
nicio comandă și nu trebuie să instalezi nimic altceva înainte. Durează aproximativ 3 minute.

> **Ce este Catastif?** O aplicație care stă pe calculatorul tău și ține evidența afacerii:
> produse, clienți, furnizori, oferte, comenzi, achiziții și rapoarte. Nu are cont, nu are
> abonament și nu trimite datele nicăieri — totul rămâne pe calculatorul tău.

---

## Pasul 1 — Deschide pagina de descărcare

Intră pe această adresă (dă clic pe ea sau copiaz-o în browser):

**https://github.com/Voicu-Andrei/catastif/releases/latest**

Se deschide pagina ultimei versiuni publicate. Sus vezi numărul versiunii, de exemplu `v1.0.0`.

Dacă pagina spune că nu există niciun release, înseamnă că încă nu a fost publicată nicio versiune.
Nu e nimic de instalat deocamdată — revino mai târziu.

---

## Pasul 2 — Descarcă fișierul de instalare

Pe pagină, derulează până la secțiunea **Assets** (Fișiere). Vei vedea o listă cu mai multe fișiere.

**Dă clic pe fișierul care se termină în `.exe`**, cel numit așa:

```
Catastif-Setup-1.0.0.exe
```

(cifrele diferă în funcție de versiune)

Descărcarea pornește imediat. Fișierul ajunge, de regulă, în folderul **Descărcări** (Downloads).

### Care fișier NU trebuie descărcat

Lângă instalator mai apar și alte fișiere. **Ignoră-le** — sunt folosite automat de aplicație
sau sunt pentru alte sisteme de operare:

| Fișier | Ce este | Îți trebuie? |
| --- | --- | --- |
| `Catastif-Setup-1.0.0.exe` | Instalatorul pentru Windows | **DA — acesta** |
| `latest.yml` | Fișier tehnic prin care aplicația își găsește singură actualizările | Nu |
| `Catastif-Setup-1.0.0.exe.blockmap` | Fișier tehnic care face actualizările mai rapide | Nu |
| `Catastif-1.0.0.dmg` | Versiunea pentru Mac | Nu (doar dacă ai Mac) |
| `Source code (zip / tar.gz)` | Codul sursă, pentru programatori | Nu |

---

## Pasul 3 — Windows îți va arăta un avertisment (este normal)

Când deschizi fișierul descărcat, Windows afișează o fereastră albastră:

> **Windows a protejat PC-ul**
> Microsoft Defender SmartScreen a împiedicat pornirea unei aplicații nerecunoscute.

**Acest avertisment nu înseamnă că aplicația are un virus.** Apare pentru că instalatorul nu are
încă o semnătură digitală cumpărată de la Microsoft (un certificat costă câteva sute de euro pe an).
Windows afișează același mesaj pentru orice program nou făcut de un dezvoltator independent.

Ca să continui:

1. Dă clic pe **Mai multe informații** (textul mic din mijlocul ferestrei).
2. Apare un buton nou jos: dă clic pe **Executați oricum**.

Dacă browserul (Chrome, Edge) spune la descărcare că fișierul „nu este descărcat frecvent” sau
„poate fi periculos”, alege **Păstrare** / **Keep**, apoi **Păstrare oricum**.

> Fii atent totuși de unde descarci: instalează **doar** fișierul luat de pe adresa de la Pasul 1.

---

## Pasul 4 — Instalează aplicația

Instalatorul te întreabă câteva lucruri simple:

1. **Pentru cine se instalează** — lasă opțiunea implicită (doar pentru tine). Așa **nu are nevoie de
   drepturi de administrator** și nici de parolă.
2. **Unde se instalează** — lasă folderul propus. Dă clic pe **Instalare**.
3. Aștepți câteva secunde, apoi **Terminare**.

Gata. Catastif apare acum în meniul **Start**. Poți să dai clic dreapta pe el → **Fixare în bara de
activități**, ca să-l ai mereu la îndemână.

---

## Pasul 5 — Prima pornire

La prima deschidere aplicația e goală — nu are date de test. Recomandăm să faci întâi două lucruri,
din meniul **Setări** (stânga jos):

1. **Datele firmei** — nume, CUI, adresă, IBAN. Acestea apar pe ofertele și comenzile tipărite în PDF.
2. **Backup și restaurare** — apasă **Alege folder** și selectează un folder din OneDrive, Google
   Drive sau de pe un stick. Apoi bifează **Backup automat la închiderea aplicației**.

> **De ce contează backupul:** toată afacerea ta stă într-un singur fișier pe acest calculator.
> Dacă laptopul se strică sau se pierde, fără backup datele se pierd odată cu el. Cu backupul
> pornit, ai mereu o copie în altă parte.

---

## Actualizările vin singure

Nu trebuie să reinstalezi nimic niciodată. Când pornești aplicația, ea verifică singură dacă a
apărut o versiune nouă. Dacă da, îți apare o fereastră cu trei opțiuni:

- **Da, actualizează** — descarcă versiunea nouă și o instalează.
- **Nu** — te întreabă din nou data viitoare.
- **Nu pentru această versiune** — sare peste această versiune, dar te anunță la următoarea.

Actualizarea păstrează toate datele tale. Nu se șterge nimic.

---

## Dezinstalare

Meniu **Start** → **Setări** → **Aplicații** → caută **Catastif** → **Dezinstalare**.

**Datele tale NU se șterg** la dezinstalare. Dacă instalezi aplicația din nou, le regăsești pe toate.
Dacă vrei să ștergi și datele, șterge manual folderul `Catastif` din:

```
%APPDATA%
```

(scrie exact `%APPDATA%` în bara de adrese a unei ferestre Explorer și apasă Enter)

---

## Probleme frecvente

| Ce se întâmplă | Ce faci |
| --- | --- |
| Windows blochează instalatorul | Pasul 3 de mai sus: **Mai multe informații** → **Executați oricum** |
| Browserul șterge fișierul descărcat | În lista de descărcări alege **Păstrare** / **Keep anyway** |
| Antivirusul se plânge | Instalatorul e nesemnat; adaugă-l la excepții sau descarcă-l din nou de pe pagina oficială |
| Aplicația nu pornește după instalare | Repornește calculatorul și încearcă din nou |
| Apare „nu ai drepturi de administrator” | Alege instalarea **doar pentru mine**, nu pentru toți utilizatorii |
| Nu găsesc fișierul descărcat | Este în folderul **Descărcări**; sau apasă `Ctrl+J` în browser |
| Vreau aplicația pe încă un calculator | Repetă pașii 1–4 acolo. Datele nu se sincronizează automat — mută-le cu **Backup → Restaurează** |

---

## Ai Mac sau Linux?

Aplicația se construiește și pentru aceste sisteme, dar **Windows este platforma principală**.

- **Mac** — descarcă fișierul `.dmg`, deschide-l și trage Catastif în folderul *Applications*.
  La prima pornire macOS spune că aplicația e de la un „dezvoltator neidentificat”: clic dreapta pe
  aplicație → **Open** → **Open**. Pe Mac actualizarea automată **nu** funcționează încă (necesită
  semnare Apple); descarcă manual versiunea nouă când apare.
- **Linux** — descarcă fișierul `.AppImage`, dă clic dreapta → **Proprietăți** → bifează
  *Permite executarea fișierului*, apoi dublu-clic.

---

## Pentru cel care publică versiunile

Pașii de mai sus funcționează abia după ce există un release publicat. Publicarea unei versiuni noi
(actualizarea `version` din `package.json` și crearea unui tag `v*`) este descrisă în
[README](../README.md#cum-lansezi-o-versiune). Restul se întâmplă automat: GitHub Actions
construiește instalatoarele și le urcă pe pagina Releases, iar aplicațiile deja instalate le găsesc
singure.
