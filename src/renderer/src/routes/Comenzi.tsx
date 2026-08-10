import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Switch,
  Table,
  Text
} from '@mantine/core'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IconClipboardList } from '@tabler/icons-react'
import type { ComandaCuExtra, StareComanda } from '@shared/types'
import { PageHeader, ComingSoon, EroareIncarcare, ListaSkeleton } from '../components/Placeholder'
import { ListToolbar } from '../components/ListToolbar'
import { formatLei, formatData } from '../lib/format'
import { STARE_META } from '../lib/stare'
import { MONTAJ_META } from '../lib/montaj'
import { mesajEroare } from '../lib/erori'

type Filtru = 'toate' | StareComanda

export function Comenzi(): React.JSX.Element {
  const navigate = useNavigate()
  const [filtru, setFiltru] = useState<Filtru>('toate')
  // Dalele de montaj de pe tabloul de bord își transmit contextul prin query
  // string — spre deosebire de dalele mai vechi, care navighează fără filtru.
  const [params] = useSearchParams()
  const [doarMontaje, setDoarMontaje] = useState(params.get('montaj') != null)
  const [items, setItems] = useState<ComandaCuExtra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    window.api.comenzi
      .list(filtru === 'toate' ? undefined : filtru)
      .then(setItems)
      .catch((err) => setError(mesajEroare(err)))
      .finally(() => setLoading(false))
  }, [filtru])

  useEffect(() => reload(), [reload])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let r = q
      ? items.filter((c) => [c.numar, c.client_nume].some((x) => x?.toLowerCase().includes(q)))
      : items
    // Ca listă de lucru („ce montez săptămâna asta”) coloana singură nu ajunge:
    // SQL-ul sortează după data creării, iar filtrul de text caută doar în număr
    // și client. Aici sortăm crescător după data montajului, cele mai vechi
    // întârzieri primele.
    if (doarMontaje) {
      r = r
        .filter((c) => c.stare_montaj === 'programat' || c.stare_montaj === 'intarziat')
        .slice()
        .sort((a, b) => (a.data_montaj ?? '').localeCompare(b.data_montaj ?? ''))
    }
    return r
  }, [items, search, doarMontaje])

  return (
    <>
      <PageHeader
        title="Comenzi"
        subtitle="Oferte și comenzi, cu profit calculat pe fiecare linie"
      />

      <Group justify="space-between" mb="md" wrap="wrap">
        <SegmentedControl
          value={filtru}
          onChange={(v) => setFiltru(v as Filtru)}
          data={[
            { label: 'Toate', value: 'toate' },
            { label: 'Oferte', value: 'oferta' },
            { label: 'Comenzi', value: 'comanda' },
            { label: 'Anulate', value: 'anulata' }
          ]}
        />
        <Switch
          label="Doar montaje de făcut"
          checked={doarMontaje}
          onChange={(e) => setDoarMontaje(e.currentTarget.checked)}
        />
      </Group>

      <ListToolbar
        search={search}
        onSearch={setSearch}
        onAdd={() => navigate('/comenzi/nou')}
        addLabel="Adaugă ofertă"
      />

      {error ? (
        <EroareIncarcare mesaj={error} onRetry={reload} />
      ) : loading ? (
        <ListaSkeleton />
      ) : items.length === 0 ? (
        <ComingSoon
          icon={<IconClipboardList size={34} />}
          title="Nicio comandă încă"
          description="Creează prima ofertă cu butonul „Adaugă ofertă”. Când clientul acceptă și plătește, devine comandă."
        />
      ) : (
        <Paper withBorder radius="lg">
          <ScrollArea>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={1040}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Număr</Table.Th>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Stare</Table.Th>
                  <Table.Th>Montaj</Table.Th>
                  <Table.Th ta="right">Total</Table.Th>
                  <Table.Th ta="right">Rest</Table.Th>
                  <Table.Th ta="right">Profit</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((c) => {
                  const meta = STARE_META[c.stare]
                  return (
                    <Table.Tr
                      key={c.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/comenzi/${c.id}`)}
                    >
                      <Table.Td>
                        <Text fw={500}>{c.numar ?? `#${c.id}`}</Text>
                      </Table.Td>
                      <Table.Td>{c.client_nume ?? <Text c="dimmed">—</Text>}</Table.Td>
                      <Table.Td>{formatData(c.data_creare)}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={meta.color}>
                          {meta.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {c.stare_montaj === 'nespecificat' ? (
                          <Text c="dimmed">—</Text>
                        ) : (
                          <>
                            <Badge variant="light" color={MONTAJ_META[c.stare_montaj].color}>
                              {MONTAJ_META[c.stare_montaj].label}
                            </Badge>
                            {c.data_montaj && (
                              <Text size="xs" c="dimmed">
                                {formatData(c.data_montaj)}
                              </Text>
                            )}
                          </>
                        )}
                      </Table.Td>
                      <Table.Td ta="right">{formatLei(c.total)}</Table.Td>
                      <Table.Td ta="right">
                        {c.rest_de_plata > 0 ? (
                          <Text c="orange.7" fw={500}>
                            {formatLei(c.rest_de_plata)}
                          </Text>
                        ) : (
                          <Text c="dimmed">0,00 lei</Text>
                        )}
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text c={c.profit >= 0 ? 'teal.7' : 'red.7'}>{formatLei(c.profit)}</Text>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
                {filtered.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Text c="dimmed" size="sm" ta="center" py="md">
                        Niciun rezultat pentru căutarea curentă.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}
    </>
  )
}
