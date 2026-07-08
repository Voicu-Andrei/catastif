import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
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
import { IconArrowLeft, IconCirclePlus, IconDeviceFloppy, IconTrash } from '@tabler/icons-react'
import type { AchizitieDetaliu, AchizitieInput, Furnizor, Produs } from '@shared/types'
import { baniToLei, leiToBani } from '../lib/money'
import { formatLei } from '../lib/format'
import { mesajEroare } from '../lib/erori'
import { useGardaNesalvat } from '../lib/useGardaNesalvat'
import { FileAttachments } from '../components/FileAttachments'

interface LinieForm {
  produs_id: string | null
  descriere: string
  cantitate: number | string
  unitate_masura: string
  cost_lei: number | string
}

interface AchizitieForm {
  furnizor_id: string | null
  data: string
  numar_document: string
  observatii: string
  linii: LinieForm[]
}

const azi = (): string => new Date().toISOString().slice(0, 10)
const emptyLinie = (): LinieForm => ({
  produs_id: null,
  descriere: '',
  cantitate: 1,
  unitate_masura: 'buc',
  cost_lei: ''
})

export function AchizitieEditor(): React.JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams()
  const esteNou = id === 'nou'
  const achizitieId = esteNou ? null : Number(id)

  const [furnizori, setFurnizori] = useState<Furnizor[]>([])
  const [produse, setProduse] = useState<Produs[]>([])

  const form = useForm<AchizitieForm>({
    initialValues: {
      furnizor_id: null,
      data: azi(),
      numar_document: '',
      observatii: '',
      linii: [emptyLinie()]
    }
  })
  useGardaNesalvat(form.isDirty())

  useEffect(() => {
    window.api.furnizori.list().then(setFurnizori)
    window.api.produse.list().then(setProduse)
  }, [])

  useEffect(() => {
    if (achizitieId != null) {
      window.api.achizitii.get(achizitieId).then((a) => {
        if (!a) {
          notifications.show({ color: 'red', title: 'Eroare', message: 'Achiziția nu există.' })
          navigate('/achizitii')
          return
        }
        form.setValues({
          furnizor_id: a.furnizor_id != null ? String(a.furnizor_id) : null,
          data: a.data,
          numar_document: a.numar_document ?? '',
          observatii: a.observatii ?? '',
          linii:
            a.linii.length > 0
              ? a.linii.map((l) => ({
                  produs_id: l.produs_id != null ? String(l.produs_id) : null,
                  descriere: l.descriere,
                  cantitate: l.cantitate,
                  unitate_masura: l.unitate_masura,
                  cost_lei: baniToLei(l.cost_unitar)
                }))
              : [emptyLinie()]
        })
        form.resetDirty()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achizitieId])

  const produseOptions = useMemo(
    () => produse.map((p) => ({ value: String(p.id), label: p.nume })),
    [produse]
  )
  const furnizoriOptions = useMemo(
    () => furnizori.map((f) => ({ value: String(f.id), label: f.nume })),
    [furnizori]
  )

  const linii = form.getValues().linii
  const totalBani = linii.reduce(
    (s, l) => s + Math.round(Number(l.cantitate || 0) * leiToBani(Number(l.cost_lei || 0))),
    0
  )

  function selecteazaProdus(idx: number, produsId: string | null): void {
    form.setFieldValue(`linii.${idx}.produs_id`, produsId)
    if (!produsId) return
    const p = produse.find((x) => String(x.id) === produsId)
    if (!p) return
    const cur = form.getValues().linii[idx]
    if (!cur.descriere.trim()) form.setFieldValue(`linii.${idx}.descriere`, p.nume)
    form.setFieldValue(`linii.${idx}.unitate_masura`, p.unitate_masura)
    if (p.ultim_cost != null && (cur.cost_lei === '' || Number(cur.cost_lei) === 0)) {
      form.setFieldValue(`linii.${idx}.cost_lei`, baniToLei(p.ultim_cost))
    }
  }

  async function salveaza(): Promise<void> {
    const liniiPayload = form
      .getValues()
      .linii.filter((l) => l.descriere.trim() !== '' || l.produs_id)
      .map((l) => ({
        produs_id: l.produs_id ? Number(l.produs_id) : null,
        descriere: l.descriere.trim(),
        cantitate: Number(l.cantitate || 0),
        unitate_masura: l.unitate_masura || 'buc',
        cost_unitar: leiToBani(Number(l.cost_lei || 0)),
        data: form.values.data
      }))
    if (liniiPayload.length === 0) {
      notifications.show({
        color: 'red',
        title: 'Achiziție goală',
        message: 'Adaugă cel puțin o linie.'
      })
      return
    }
    const payload: AchizitieInput = {
      furnizor_id: form.values.furnizor_id ? Number(form.values.furnizor_id) : null,
      data: form.values.data,
      numar_document: form.values.numar_document.trim() || null,
      observatii: form.values.observatii.trim() || null,
      linii: liniiPayload
    }
    try {
      let saved: AchizitieDetaliu
      if (esteNou) saved = await window.api.achizitii.create(payload)
      else saved = await window.api.achizitii.update(achizitieId!, payload)
      notifications.show({ color: 'teal', title: 'Salvat', message: 'Achiziția a fost salvată.' })
      form.resetDirty()
      navigate(`/achizitii/${saved.id}`)
    } catch (err) {
      notifications.show({ color: 'red', title: 'Eroare', message: mesajEroare(err) })
    }
  }

  function confirmaStergere(): void {
    modals.openConfirmModal({
      title: 'Șterge achiziția',
      children: (
        <Text size="sm">
          Sigur ștergi această achiziție? Stocul adăugat de ea va fi scăzut înapoi.
        </Text>
      ),
      labels: { confirm: 'Șterge', cancel: 'Renunță' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await window.api.achizitii.delete(achizitieId!)
          form.resetDirty()
          navigate('/achizitii')
        } catch (err) {
          notifications.show({
            color: 'red',
            title: 'Nu se poate șterge',
            message: mesajEroare(err)
          })
        }
      }
    })
  }

  return (
    <>
      <Group justify="space-between" mb="lg" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => navigate('/achizitii')}
            aria-label="Înapoi"
          >
            <IconArrowLeft />
          </ActionIcon>
          <Title order={2} style={{ letterSpacing: '-0.02em' }}>
            {esteNou ? 'Achiziție nouă' : `Achiziție #${achizitieId}`}
          </Title>
        </Group>
        <Group gap="sm">
          {!esteNou && (
            <Button
              variant="subtle"
              color="red"
              leftSection={<IconTrash size={18} />}
              onClick={confirmaStergere}
            >
              Șterge
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
              <Grid.Col span={{ base: 12, sm: 5 }}>
                <Select
                  label="Furnizor"
                  placeholder="Alege furnizor"
                  data={furnizoriOptions}
                  value={form.values.furnizor_id}
                  onChange={(v) => form.setFieldValue('furnizor_id', v)}
                  searchable
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <TextInput label="Data" type="date" {...form.getInputProps('data')} />
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 4 }}>
                <TextInput label="Nr. document" {...form.getInputProps('numar_document')} />
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
              <Table verticalSpacing="xs" horizontalSpacing="xs" miw={680}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ minWidth: 280 }}>Descriere</Table.Th>
                    <Table.Th w={90}>Cant.</Table.Th>
                    <Table.Th w={120}>Cost/buc</Table.Th>
                    <Table.Th w={120} ta="right">
                      Subtotal
                    </Table.Th>
                    <Table.Th w={36} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {linii.map((l, idx) => {
                    const subtotal = Math.round(
                      Number(l.cantitate || 0) * leiToBani(Number(l.cost_lei || 0))
                    )
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
                              placeholder="Descriere"
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
                        <Table.Td ta="right">
                          <Text size="sm">{formatLei(subtotal)}</Text>
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
              label="Observații"
              mt="md"
              autosize
              minRows={2}
              {...form.getInputProps('observatii')}
            />
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card withBorder radius="lg" padding="lg">
            <Group justify="space-between">
              <Text fw={700}>Total achiziție</Text>
              <Text fw={700} fz="lg">
                {formatLei(totalBani)}
              </Text>
            </Group>
            <Text size="xs" c="dimmed" mt="sm">
              Produsele cu stoc urmărit își cresc automat stocul cu cantitățile de mai sus.
            </Text>
          </Card>

          {!esteNou && achizitieId != null && (
            <Box mt="lg">
              <FileAttachments entitateTip="achizitie" entitateId={achizitieId} />
            </Box>
          )}
        </Grid.Col>
      </Grid>
    </>
  )
}
