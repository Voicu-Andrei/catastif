import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Group,
  LoadingOverlay,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Table,
  Text
} from '@mantine/core'
import { BarChart } from '@mantine/charts'
import { notifications } from '@mantine/notifications'
import { IconEye, IconPrinter } from '@tabler/icons-react'
import type { RaportData } from '@shared/types'
import { PageHeader, EroareIncarcare } from '../components/Placeholder'
import { mesajEroare } from '../lib/erori'
import { ExportButtons } from '../components/ExportButtons'
import { formatLei } from '../lib/format'
import { baniToLei } from '../lib/money'

const LUNI_SCURT = [
  'Ian',
  'Feb',
  'Mar',
  'Apr',
  'Mai',
  'Iun',
  'Iul',
  'Aug',
  'Sep',
  'Oct',
  'Noi',
  'Dec'
]

export function Rapoarte(): React.JSX.Element {
  const [an, setAn] = useState<number>(new Date().getFullYear())
  const [data, setData] = useState<RaportData | null>(null)
  const [eroare, setEroare] = useState<string | null>(null)
  const [sePregatestePdf, setSePregatestePdf] = useState(false)
  const [sePregatesteVizualizare, setSePregatesteVizualizare] = useState(false)

  // Previzualizarea deschide raportul într-o fereastră proprie, fără să ceară
  // unde să fie salvat — util când vrei doar să te uiți peste cifre.
  async function previzualizeazaPdf(): Promise<void> {
    if (sePregatesteVizualizare) return
    setSePregatesteVizualizare(true)
    try {
      const r = await window.api.pdf.previzualizeazaRaport(an)
      if (!r.ok && r.mesaj) {
        notifications.show({ color: 'red', title: 'Previzualizare eșuată', message: r.mesaj })
      }
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Previzualizare eșuată',
        message: mesajEroare(err)
      })
    } finally {
      setSePregatesteVizualizare(false)
    }
  }

  // Rezultatul era aruncat: un disc plin sau un folder de rețea deconectat
  // însemnau că nu se întâmpla absolut nimic pe ecran, la nesfârșit.
  async function exportaPdf(): Promise<void> {
    if (sePregatestePdf) return
    setSePregatestePdf(true)
    try {
      const r = await window.api.pdf.raport(an)
      if (r.ok) {
        notifications.show({ color: 'teal', title: 'PDF salvat', message: r.cale ?? '' })
      } else if (r.mesaj && r.mesaj !== 'Export anulat.') {
        notifications.show({ color: 'red', title: 'Export eșuat', message: r.mesaj })
      }
    } catch (err) {
      notifications.show({ color: 'red', title: 'Export eșuat', message: mesajEroare(err) })
    } finally {
      setSePregatestePdf(false)
    }
  }

  useEffect(() => {
    setEroare(null)
    window.api.rapoarte
      .get(an)
      .then(setData)
      .catch((err) => setEroare(mesajEroare(err)))
  }, [an])

  const chartData = (data?.vanzari_lunare ?? []).map((m, i) => ({
    luna: LUNI_SCURT[i],
    Vânzări: baniToLei(m.total_fara_tva),
    Profit: baniToLei(m.profit)
  }))

  const aniOptions = (data?.ani ?? [an]).map((a) => ({ value: String(a), label: String(a) }))

  return (
    <>
      <PageHeader
        title="Rapoarte"
        subtitle="Profit, vânzări și încasări"
        action={
          <Group gap="sm">
            <Select
              data={aniOptions}
              value={String(an)}
              onChange={(v) => setAn(Number(v ?? an))}
              allowDeselect={false}
              w={110}
            />
            <Button
              variant="default"
              leftSection={<IconEye size={18} />}
              onClick={previzualizeazaPdf}
              loading={sePregatesteVizualizare}
            >
              Vezi PDF
            </Button>
            <Button
              variant="default"
              leftSection={<IconPrinter size={18} />}
              onClick={exportaPdf}
              loading={sePregatestePdf}
            >
              Salvează PDF
            </Button>
          </Group>
        }
      />

      {eroare ? (
        <EroareIncarcare mesaj={eroare} />
      ) : (
        <Box pos="relative">
          <LoadingOverlay visible={!data} />
          <Paper withBorder radius="lg" p="lg" mb="lg">
            <Text fw={600} mb="md">
              Vânzări și profit pe luni ({an})
            </Text>
            <BarChart
              h={300}
              data={chartData}
              dataKey="luna"
              series={[
                { name: 'Vânzări', color: 'brand.6' },
                { name: 'Profit', color: 'blue.5' }
              ]}
              valueFormatter={(v) => `${v.toLocaleString('ro-RO')} lei`}
              withLegend
            />
          </Paper>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" mb="lg">
            <Paper withBorder radius="lg" p="lg">
              <Group justify="space-between" mb="sm">
                <Text fw={600}>Profit pe client</Text>
                <ExportButtons
                  numeFisier={`Profit-pe-client-${an}`}
                  headers={['Client', 'Vânzări (lei)', 'Profit (lei)']}
                  rows={(data?.profit_pe_client ?? []).map((c) => [
                    c.client,
                    baniToLei(c.total),
                    baniToLei(c.profit)
                  ])}
                  disabled={!data?.profit_pe_client.length}
                />
              </Group>
              <ScrollArea>
                <Table verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Client</Table.Th>
                      <Table.Th ta="right">Vânzări</Table.Th>
                      <Table.Th ta="right">Profit</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(data?.profit_pe_client ?? []).map((c, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{c.client}</Table.Td>
                        <Table.Td ta="right">{formatLei(c.total)}</Table.Td>
                        <Table.Td ta="right">{formatLei(c.profit)}</Table.Td>
                      </Table.Tr>
                    ))}
                    {!data?.profit_pe_client.length && (
                      <Table.Tr>
                        <Table.Td colSpan={3}>
                          <Text c="dimmed" size="sm">
                            Nicio comandă confirmată în {an}.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>

            <Paper withBorder radius="lg" p="lg">
              <Group justify="space-between" mb="sm">
                <Text fw={600}>Achiziții pe furnizor</Text>
                <ExportButtons
                  numeFisier={`Achizitii-pe-furnizor-${an}`}
                  headers={['Furnizor', 'Total (lei)']}
                  rows={(data?.achizitii_pe_furnizor ?? []).map((f) => [
                    f.furnizor,
                    baniToLei(f.total)
                  ])}
                  disabled={!data?.achizitii_pe_furnizor.length}
                />
              </Group>
              <ScrollArea>
                <Table verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Furnizor</Table.Th>
                      <Table.Th ta="right">Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(data?.achizitii_pe_furnizor ?? []).map((f, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{f.furnizor}</Table.Td>
                        <Table.Td ta="right">{formatLei(f.total)}</Table.Td>
                      </Table.Tr>
                    ))}
                    {!data?.achizitii_pe_furnizor.length && (
                      <Table.Tr>
                        <Table.Td colSpan={2}>
                          <Text c="dimmed" size="sm">
                            Nicio achiziție în {an}.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>
          </SimpleGrid>

          <Paper withBorder radius="lg" p="lg">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>De încasat (toate comenzile)</Text>
              <ExportButtons
                numeFisier="De-incasat"
                headers={['Comandă', 'Client', 'Total (lei)', 'Achitat (lei)', 'Rest (lei)']}
                rows={(data?.de_incasat ?? []).map((r) => [
                  r.numar ?? `#${r.id}`,
                  r.client ?? '—',
                  baniToLei(r.total),
                  baniToLei(r.achitat),
                  baniToLei(r.rest)
                ])}
                disabled={!data?.de_incasat.length}
              />
            </Group>
            <ScrollArea>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Comandă</Table.Th>
                    <Table.Th>Client</Table.Th>
                    <Table.Th ta="right">Total</Table.Th>
                    <Table.Th ta="right">Achitat</Table.Th>
                    <Table.Th ta="right">Rest</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(data?.de_incasat ?? []).map((r) => (
                    <Table.Tr key={r.id}>
                      <Table.Td>{r.numar ?? `#${r.id}`}</Table.Td>
                      <Table.Td>{r.client ?? '—'}</Table.Td>
                      <Table.Td ta="right">{formatLei(r.total)}</Table.Td>
                      <Table.Td ta="right">{formatLei(r.achitat)}</Table.Td>
                      <Table.Td ta="right">
                        <Text c="orange.7" fw={500}>
                          {formatLei(r.rest)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {!data?.de_incasat.length && (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text c="dimmed" size="sm">
                          Nimic de încasat. 🎉
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        </Box>
      )}
    </>
  )
}
