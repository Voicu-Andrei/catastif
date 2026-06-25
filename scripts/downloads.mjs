#!/usr/bin/env node
// Afișează câte descărcări are fiecare versiune publicată pe GitHub Releases.
// Nu necesită autentificare pentru un repository public.
// Folosire: npm run downloads

const OWNER = process.env.CATASTIF_OWNER || 'voicu-andrei'
const REPO = process.env.CATASTIF_REPO || 'catastif'

const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=100`

const res = await fetch(url, {
  headers: {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'catastif-downloads',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
  }
})

if (!res.ok) {
  console.error(`Eroare GitHub API: ${res.status} ${res.statusText}`)
  if (res.status === 404) {
    console.error('Repository-ul nu a fost găsit sau nu are încă niciun release publicat.')
  }
  process.exit(1)
}

const releases = await res.json()

if (!Array.isArray(releases) || releases.length === 0) {
  console.log('Niciun release publicat încă — nimic de numărat.')
  process.exit(0)
}

let total = 0
console.log('')
console.log('  Versiune'.padEnd(22) + 'Descărcări')
console.log('  ' + '─'.repeat(32))
for (const r of releases) {
  let rel = 0
  for (const a of r.assets ?? []) rel += a.download_count ?? 0
  total += rel
  const eticheta = (r.tag_name || r.name || '(fără tag)').toString()
  console.log('  ' + eticheta.padEnd(20) + String(rel).padStart(10))
}
console.log('  ' + '─'.repeat(32))
console.log('  ' + 'TOTAL'.padEnd(20) + String(total).padStart(10))
console.log('')
