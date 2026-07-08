import { useMemo, useState } from 'react'
import { Paper, ScrollArea, Table, Text } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { IconShoppingCart } from '@tabler/icons-react'
import type { AchizitieCuExtra } from '@shared/types'
import { PageHeader, ComingSoon, EroareIncarcare } from '../components/Placeholder'
import { ListToolbar } from '../components/ListToolbar'
import { useList } from '../lib/useList'
import { formatLei, formatData } from '../lib/format'

export function Achizitii(): React.JSX.Element {
  const navigate = useNavigate()
  const { items, loading, error, reload } = useList<AchizitieCuExtra>(window.api.achizitii.list)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((a) =>
      [a.furnizor_nume, a.numar_document].some((x) => x?.toLowerCase().includes(q))
    )
  }, [items, search])

  return (
    <>
      <PageHeader
        title="Achiziții"
        subtitle="Cumpărări de la furnizori — sursa istoricului de costuri"
      />
      <ListToolbar
        search={search}
        onSearch={setSearch}
        onAdd={() => navigate('/achizitii/nou')}
        addLabel="Adaugă achiziție"
      />

      {error ? (
        <EroareIncarcare mesaj={error} onRetry={reload} />
      ) : !loading && items.length === 0 ? (
        <ComingSoon
          icon={<IconShoppingCart size={34} />}
          title="Nicio achiziție încă"
          description="Înregistrează prima cumpărare de la un furnizor. Costurile devin istoric și, pentru produsele urmărite, cresc stocul."
        />
      ) : (
        <Paper withBorder radius="lg">
          <ScrollArea>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={760}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Furnizor</Table.Th>
                  <Table.Th>Document</Table.Th>
                  <Table.Th ta="center">Linii</Table.Th>
                  <Table.Th ta="right">Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((a) => (
                  <Table.Tr
                    key={a.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/achizitii/${a.id}`)}
                  >
                    <Table.Td>{formatData(a.data)}</Table.Td>
                    <Table.Td>
                      <Text fw={500}>{a.furnizor_nume ?? '—'}</Text>
                    </Table.Td>
                    <Table.Td>{a.numar_document ?? '—'}</Table.Td>
                    <Table.Td ta="center">{a.nr_linii}</Table.Td>
                    <Table.Td ta="right">{formatLei(a.total)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}
    </>
  )
}
