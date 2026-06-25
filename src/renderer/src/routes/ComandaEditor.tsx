import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft,
  IconCheck,
  IconCirclePlus,
  IconCash,
  IconTrash,
  IconBan,
  IconDeviceFloppy
} from '@tabler/icons-react'
import type { Client, ComandaDetaliu, ComandaInput, Produs } from '@shared/types'
import { calcComanda, calcLinie } from '@shared/calc'
import { baniToLei, leiToBani } from '../lib/money'
import { formatLei } from '../lib/format'
import { STARE_META } from '../lib/stare'

interface LinieForm {
  produs_id: string | null
  descriere: string
  cantitate: number | string
  unitate_masura: string
  cost_lei: number | string
  pret_lei: number | string
  cota_tva: number
}

interface ComandaForm {
  numar: string
  client_id: string | null
  observatii: string
  linii: LinieForm[]
}

const emptyLinie = (): LinieForm => ({
  produs_id: null,
  descriere: '',
  cantitate: 1,
  unitate_masura: 'buc',
  cost_lei: '',
  pret_lei: '',
  cota_tva: 21
})

const TVA_DATA = [
  { value: '21', label: '21%' },
  { value: '11', label: '11%' },
  { value: '9', label: '9%' },
  { value: '0', label: '0%' }
]

export function ComandaEditor(): React.JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams()
  const esteNou = id === 'nou'
  const comandaId = esteNou ? null : Number(id)

  const [clienti, setClienti] = useState<Client[]>([])
  const [produse, setProduse] = useState<Produs[]>([])
  const [comanda, setComanda] = useState<ComandaDetaliu | null>(null)
  const [plataLei, setPlataLei] = useState<number | string>('')

  const form = useForm<ComandaForm>({
    initialValues: { numar: '', client_id: null, observatii: '', linii: [emptyLinie()] }
  })

  useEffect(() => {
    window.api.clienti.list().then(setClienti)
    window.api.produse.list().then(setProduse)
  }, [])

  function incarcaComanda(c: ComandaDetaliu): void {
    setComanda(c)
    form.setValues({
      numar: c.numar ?? '',
      client_id: c.client_id != null ? String(c.client_id) : null,
      observatii: c.observatii ?? '',
      linii:
        c.linii.length > 0
          ? c.linii.map((l) => ({
              produs_id: l.produs_id != null ? String(l.produs_id) : null,
              descriere: l.descriere,
              cantitate: l.cantitate,
              unitate_masura: l.unitate_masura,
              cost_lei: baniToLei(l.cost_unitar),
              pret_lei: baniToLei(l.pret_unitar),
              cota_tva: l.cota_tva
            }))
          : [emptyLinie()]
    })
    form.resetDirty()
  }

  useEffect(() => {
    if (comandaId != null) {
      window.api.comenzi.get(comandaId).then((c) => {
        if (c) incarcaComanda(c)
        else {
          notifications.show({ color: 'red', title: 'Eroare', message: 'Comanda nu există.' })
          navigate('/comenzi')
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandaId])

  const clientiOptions = useMemo(
    () => clienti.map((c) => ({ value: String(c.id), label: c.nume })),
    [clienti]
  )
  const produseOptions = useMemo(
    () => produse.map((p) => ({ value: String(p.id), label: p.nume })),
    [produse]
  )

  // Totaluri live (în bani) din valorile curente ale formularului.
  const liniiBani = form.getValues().linii.map((l) => ({
    cantitate: Number(l.cantitate || 0),
    cost_unitar: leiToBani(Number(l.cost_lei || 0)),
    pret_unitar: leiToBani(Number(l.pret_lei || 0)),
    cota_tva: Number(l.cota_tva)
  }))
  const totaluri = calcComanda(liniiBani)

  function selecteazaProdus(idx: number, produsId: string | null): void {
    form.setFieldValue(`linii.${idx}.produs_id`, produsId)
    if (!produsId) return
    const p = produse.find((x) => String(x.id) === produsId)
    if (!p) return
    const cur = form.getValues().linii[idx]
    if (!cur.descriere.trim()) {
      form.setFieldValue(
        `linii.${idx}.descriere`,
        p.descriere ? `${p.nume} — ${p.descriere}` : p.nume
      )
    }
    form.setFieldValue(`linii.${idx}.unitate_masura`, p.unitate_masura)
    form.setFieldValue(`linii.${idx}.cota_tva`, p.cota_tva)
    if (p.pret_referinta != null && (cur.pret_lei === '' || Number(cur.pret_lei) === 0)) {
      form.setFieldValue(`linii.${idx}.pret_lei`, baniToLei(p.pret_referinta))
    }
    // Pre-completează costul cu ultimul cost de achiziție, dacă există.
    if (p.ultim_cost != null && (cur.cost_lei === '' || Number(cur.cost_lei) === 0)) {
      form.setFieldValue(`linii.${idx}.cost_lei`, baniToLei(p.ultim_cost))
    }
  }

  function construiestePayload(): ComandaInput {
    const linii = form
      .getValues()
      .linii.filter((l) => l.descriere.trim() !== '' || l.produs_id)
      .map((l, i) => ({
        produs_id: l.produs_id ? Number(l.produs_id) : null,
        descriere: l.descriere.trim(),
        cantitate: Number(l.cantitate || 0),
        unitate_masura: l.unitate_masura || 'buc',
        cost_unitar: leiToBani(Number(l.cost_lei || 0)),
        pret_unitar: leiToBani(Number(l.pret_lei || 0)),
        cota_tva: Number(l.cota_tva),
        pozitie: i
      }))
    return {
      numar: form.values.numar.trim() || null,
      client_id: form.values.client_id ? Number(form.values.client_id) : null,
      observatii: form.values.observatii.trim() || null,
      linii
    }
  }

  async function salveaza(): Promise<void> {
    const payload = construiestePayload()
    if (payload.linii.length === 0) {
      notifications.show({
        color: 'red',
        title: 'Comandă goală',
        message: 'Adaugă cel puțin o linie cu descriere.'
      })
      return
    }
    try {
      if (esteNou) {
        const c = await window.api.comenzi.create(payload)
        notifications.show({ color: 'teal', title: 'Salvat', message: 'Oferta a fost creată.' })
        navigate(`/comenzi/${c.id}`)
      } else {
        const c = await window.api.comenzi.update(comandaId!, payload)
        incarcaComanda(c)
        notifications.show({ color: 'teal', title: 'Salvat', message: 'Comanda a fost salvată.' })
      }
    } catch (err) {
      notifications.show({ color: 'red', title: 'Eroare', message: (err as Error).message })
    }
  }

  async function accepta(): Promise<void> {
    const c = await window.api.comenzi.accepta(comandaId!)
    incarcaComanda(c)
    notifications.show({ color: 'teal', title: 'Acceptată', message: 'Oferta a devenit comandă.' })
  }

  function confirmaAnulare(): void {
    modals.openConfirmModal({
      title: 'Anulează comanda',
      children: (
        <Text size="sm">
          Comanda va fi marcată drept <b>anulată</b>, dar rămâne în istoric. Continui?
        </Text>
      ),
      labels: { confirm: 'Anulează comanda', cancel: 'Renunță' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const c = await window.api.comenzi.anuleaza(comandaId!)
        incarcaComanda(c)
        notifications.show({ color: 'gray', title: 'Anulată', message: 'Comanda a fost anulată.' })
      }
    })
  }

  function confirmaStergere(): void {
    modals.openConfirmModal({
      title: 'Șterge oferta',
      children: <Text size="sm">Sigur ștergi această ofertă? Acțiunea nu poate fi anulată.</Text>,
      labels: { confirm: 'Șterge', cancel: 'Renunță' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await window.api.comenzi.delete(comandaId!)
        navigate('/comenzi')
      }
    })
  }

  async function inregistreazaPlata(): Promise<void> {
    const suma = Number(plataLei || 0)
    if (suma <= 0) return
    const c = await window.api.comenzi.plata(comandaId!, leiToBani(suma))
    incarcaComanda(c)
    setPlataLei('')
    notifications.show({ color: 'teal', title: 'Plată înregistrată', message: formatLei(leiToBani(suma)) })
  }

  const stareMeta = comanda ? STARE_META[comanda.stare] : STARE_META.oferta
  const linii = form.getValues().linii

  return (
    <>
      <Group justify="space-between" mb="lg" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ActionIcon variant="subtle" size="lg" onClick={() => navigate('/comenzi')} aria-label="Înapoi">
            <IconArrowLeft />
          </ActionIcon>
          <div>
            <Group gap="sm">
              <Title order={2} style={{ letterSpacing: '-0.02em' }}>
                {esteNou ? 'Ofertă nouă' : (comanda?.numar ?? `#${comandaId}`)}
              </Title>
              {!esteNou && (
                <Badge variant="light" color={stareMeta.color} size="lg">
                  {stareMeta.label}
                </Badge>
              )}
            </Group>
            {!esteNou && comanda && (
              <Text c="dimmed" size="sm">
                Creată {new Date(comanda.data_creare).toLocaleDateString('ro-RO')}
              </Text>
            )}
          </div>
        </Group>
        <Group gap="sm">
          {!esteNou && comanda?.stare === 'oferta' && (
            <Button variant="light" color="teal" leftSection={<IconCheck size={18} />} onClick={accepta}>
              Acceptă (devine comandă)
            </Button>
          )}
          {!esteNou && comanda?.stare === 'oferta' && (
            <Button variant="subtle" color="red" leftSection={<IconTrash size={18} />} onClick={confirmaStergere}>
              Șterge
            </Button>
          )}
          {!esteNou && comanda?.stare === 'comanda' && (
            <Button variant="subtle" color="red" leftSection={<IconBan size={18} />} onClick={confirmaAnulare}>
              Anulează
            </Button>
          )}
          <Button leftSection={<IconDeviceFloppy size={18} />} onClick={salveaza}>
            Salvează
          </Button>
        </Group>
      </Group>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper withBorder radius="lg" p="lg" mb="lg">
            <Grid>
              <Grid.Col span={{ base: 12, sm: 8 }}>
                <Select
                  label="Client"
                  placeholder="Alege client"
                  data={clientiOptions}
                  value={form.values.client_id}
                  onChange={(v) => form.setFieldValue('client_id', v)}
                  searchable
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="Număr"
                  placeholder="automat"
                  {...form.getInputProps('numar')}
                />
              </Grid.Col>
            </Grid>
          </Paper>

          <Paper withBorder radius="lg" p="lg">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>Linii</Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconCirclePlus size={16} />}
                onClick={() => form.insertListItem('linii', emptyLinie())}
              >
                Adaugă linie
              </Button>
            </Group>
            <ScrollArea>
              <Table verticalSpacing="xs" horizontalSpacing="xs" miw={820}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ minWidth: 260 }}>Descriere</Table.Th>
                    <Table.Th w={80}>Cant.</Table.Th>
                    <Table.Th w={110}>Cost/buc</Table.Th>
                    <Table.Th w={110}>Preț/buc</Table.Th>
                    <Table.Th w={90}>TVA</Table.Th>
                    <Table.Th w={110} ta="right">
                      Profit
                    </Table.Th>
                    <Table.Th w={36} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {linii.map((_l, idx) => {
                    const lc = calcLinie(liniiBani[idx])
                    return (
                      <Table.Tr key={idx}>
                        <Table.Td>
                          <Stack gap={4}>
                            <Select
                              placeholder="Produs (opțional)"
                              data={produseOptions}
                              value={linii[idx].produs_id}
                              onChange={(v) => selecteazaProdus(idx, v)}
                              searchable
                              clearable
                              size="xs"
                            />
                            <TextInput
                              placeholder="Descriere (ex. Fereastră PVC 120×150, alb)"
                              size="xs"
                              key={form.key(`linii.${idx}.descriere`)}
                              {...form.getInputProps(`linii.${idx}.descriere`)}
                            />
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            min={0}
                            hideControls
                            key={form.key(`linii.${idx}.cantitate`)}
                            {...form.getInputProps(`linii.${idx}.cantitate`)}
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            min={0}
                            decimalScale={2}
                            hideControls
                            key={form.key(`linii.${idx}.cost_lei`)}
                            {...form.getInputProps(`linii.${idx}.cost_lei`)}
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            min={0}
                            decimalScale={2}
                            hideControls
                            key={form.key(`linii.${idx}.pret_lei`)}
                            {...form.getInputProps(`linii.${idx}.pret_lei`)}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Select
                            size="xs"
                            data={TVA_DATA}
                            allowDeselect={false}
                            value={String(linii[idx].cota_tva)}
                            onChange={(v) => form.setFieldValue(`linii.${idx}.cota_tva`, Number(v ?? 21))}
                          />
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm" c={lc.profit >= 0 ? 'teal.7' : 'red.7'}>
                            {formatLei(lc.profit)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Tooltip label="Șterge linia">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="sm"
                              onClick={() => form.removeListItem('linii', idx)}
                              disabled={linii.length === 1}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            <Textarea
              label="Observatii"
              mt="md"
              autosize
              minRows={2}
              {...form.getInputProps('observatii')}
            />
          </Paper>
        </Grid.Col>

        {/* Panou totaluri + plăți */}
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card withBorder radius="lg" padding="lg">
            <Text fw={600} mb="sm">
              Totaluri
            </Text>
            <Stack gap={8}>
              <Group justify="space-between">
                <Text c="dimmed">Fără TVA</Text>
                <Text>{formatLei(totaluri.total_fara_tva)}</Text>
              </Group>
              <Group justify="space-between">
                <Text c="dimmed">TVA</Text>
                <Text>{formatLei(totaluri.total_tva)}</Text>
              </Group>
              <Group justify="space-between">
                <Text fw={700}>Total</Text>
                <Text fw={700} fz="lg">
                  {formatLei(totaluri.total)}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text c="dimmed">Profit estimat</Text>
                <Text c={totaluri.profit >= 0 ? 'teal.7' : 'red.7'} fw={500}>
                  {formatLei(totaluri.profit)}
                </Text>
              </Group>
            </Stack>

            {!esteNou && comanda && comanda.stare !== 'anulata' && (
              <>
                <Box my="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }} />
                <Text fw={600} mb="sm">
                  Plăți
                </Text>
                <Stack gap={8}>
                  <Group justify="space-between">
                    <Text c="dimmed">Achitat</Text>
                    <Text>{formatLei(comanda.achitat)}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text c="dimmed">Rest de plată</Text>
                    <Text fw={600} c={comanda.rest_de_plata > 0 ? 'orange.7' : 'teal.7'}>
                      {formatLei(comanda.rest_de_plata)}
                    </Text>
                  </Group>
                  <Group align="flex-end" gap="xs" mt="xs">
                    <NumberInput
                      label="Sumă (lei)"
                      placeholder="0,00"
                      min={0}
                      decimalScale={2}
                      value={plataLei}
                      onChange={setPlataLei}
                      style={{ flex: 1 }}
                    />
                    <Button leftSection={<IconCash size={18} />} onClick={inregistreazaPlata}>
                      Adaugă
                    </Button>
                  </Group>
                  {comanda.stare === 'oferta' && (
                    <Text size="xs" c="dimmed">
                      Prima plată transformă oferta în comandă.
                    </Text>
                  )}
                </Stack>
              </>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </>
  )
}
