#!/usr/bin/env node
// Generează iconița aplicației (build/icon.png, 1024×1024) fără dependențe externe.
// electron-builder construiește din ea .ico pentru Windows și .icns pentru macOS.
//
// Folosire: npm run iconita
//
// Motivul pentru care desenăm în cod, nu ținem un binar în repo: iconița poate fi
// regenerată oricând, iar diferențele se văd în istoric ca modificări de cod.
// Ai un logo propriu? Înlocuiește build/icon.png (minim 512×512, PNG cu alfa).

import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const RADACINA = join(dirname(fileURLToPath(import.meta.url)), '..')

const DIM = 1024 // latura imaginii finale
const SS = 3 // supraeșantionare (antialiasing prin mediere)

// Paleta de brand (aceleași verzi ca în interfață).
const VERDE_SUS = [0x0a, 0x8f, 0x74]
const VERDE_JOS = [0x00, 0x5c, 0x4a]
const ALB = [0xff, 0xff, 0xff]

const amesteca = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)

// Distanța semnată față de un dreptunghi cu colțuri rotunjite, centrat în (cx, cy).
function distDreptunghiRotunjit(x, y, cx, cy, latime, inaltime, raza) {
  const dx = Math.abs(x - cx) - (latime / 2 - raza)
  const dy = Math.abs(y - cy) - (inaltime / 2 - raza)
  const ax = Math.max(dx, 0)
  const ay = Math.max(dy, 0)
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(dx, dy), 0) - raza
}

// Un „catastif” este un registru: fundal verde + rândurile albe ale registrului,
// cu cotorul marcat în stânga. Se citește și la 16×16 în bara de activități.
function deseneaza(x, y, dim) {
  const u = dim / 100 // unitate procentuală, ca desenul să nu depindă de rezoluție

  // Placa de fundal (pătrat rotunjit, cu o mică margine).
  const placa = distDreptunghiRotunjit(x, y, dim / 2, dim / 2, 92 * u, 92 * u, 21 * u)
  const acoperirePlaca = Math.min(Math.max(0.5 - placa, 0), 1)
  if (acoperirePlaca <= 0) return [0, 0, 0, 0]

  const fundal = amesteca(VERDE_SUS, VERDE_JOS, y / dim)

  // Cotorul registrului: o bandă verticală puțin mai deschisă în stânga.
  const cotor = distDreptunghiRotunjit(x, y, 26 * u, dim / 2, 7 * u, 62 * u, 3.5 * u)
  const acoperireCotor = Math.min(Math.max(0.5 - cotor, 0), 1)

  // Rândurile registrului: trei linii albe de lățimi diferite, ca un text scris.
  const randuri = [
    { y: 36, latime: 40 },
    { y: 50, latime: 40 },
    { y: 64, latime: 26 }
  ]
  let acoperireRanduri = 0
  for (const r of randuri) {
    const cx = 41 * u + (r.latime * u) / 2
    const d = distDreptunghiRotunjit(x, y, cx, r.y * u, r.latime * u, 7 * u, 3.5 * u)
    acoperireRanduri = Math.max(acoperireRanduri, Math.min(Math.max(0.5 - d, 0), 1))
  }

  let culoare = fundal
  culoare = amesteca(culoare, ALB, acoperireCotor * 0.45)
  culoare = amesteca(culoare, ALB, acoperireRanduri)

  return [...culoare, acoperirePlaca * 255]
}

// --- randare cu supraeșantionare ---
const pixeli = Buffer.alloc(DIM * DIM * 4)
const mareste = DIM * SS
for (let y = 0; y < DIM; y++) {
  for (let x = 0; x < DIM; x++) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const p = deseneaza(x * SS + sx + 0.5, y * SS + sy + 0.5, mareste)
        // Premultiplicăm ca marginile transparente să nu capete un halou închis.
        r += p[0] * (p[3] / 255)
        g += p[1] * (p[3] / 255)
        b += p[2] * (p[3] / 255)
        a += p[3]
      }
    }
    const n = SS * SS
    const alfa = a / n
    const i = (y * DIM + x) * 4
    // Depremultiplicăm înapoi la RGBA direct (PNG stochează culoarea nepremultiplicată).
    const f = alfa > 0 ? 255 / alfa : 0
    pixeli[i] = Math.round(Math.min((r / n) * f, 255))
    pixeli[i + 1] = Math.round(Math.min((g / n) * f, 255))
    pixeli[i + 2] = Math.round(Math.min((b / n) * f, 255))
    pixeli[i + 3] = Math.round(alfa)
  }
}

// --- codare PNG (RGBA pe 8 biți, fără filtre) ---
const TABEL_CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = TABEL_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(tip, date) {
  const lungime = Buffer.alloc(4)
  lungime.writeUInt32BE(date.length)
  const corp = Buffer.concat([Buffer.from(tip, 'ascii'), date])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corp))
  return Buffer.concat([lungime, corp, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(DIM, 0)
ihdr.writeUInt32BE(DIM, 4)
ihdr[8] = 8 // adâncime pe canal
ihdr[9] = 6 // RGBA
// 10..12 rămân 0: compresie deflate, filtrare standard, fără întrețesere

const brut = Buffer.alloc(DIM * (DIM * 4 + 1))
for (let y = 0; y < DIM; y++) {
  brut[y * (DIM * 4 + 1)] = 0 // tip de filtru „None”
  pixeli.copy(brut, y * (DIM * 4 + 1) + 1, y * DIM * 4, (y + 1) * DIM * 4)
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(brut, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const iesire = join(RADACINA, 'build', 'icon.png')
mkdirSync(dirname(iesire), { recursive: true })
writeFileSync(iesire, png)
console.log(`Iconiță scrisă: ${iesire} (${DIM}×${DIM}, ${(png.length / 1024).toFixed(1)} kB)`)
