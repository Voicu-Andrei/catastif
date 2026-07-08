import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { IconBox, IconPencil, IconTrash } from '@tabler/icons-react'
import type { Furnizor, Produs, ProdusInput } from '@shared/types'
import { PageHeader, ComingSoon, EroareIncarcare } from '../components/Placeholder'
import { ListToolbar } from '../components/ListToolbar'
import { FileAttachments } from '../components/FileAttachments'
import { useList } from '../lib/useList'
import { mesajEroare } from '../lib/erori'
import { baniToLei, leiToBani } from '../lib/money'
import { formatLei } from '../lib/format'

interface ProdusForm {
  nume: string
  descriere: string
  unitate_masura: string
  pret_lei: number | string
  cota_tva: number
  track_stock: boolean
  stoc_curent: number | string
  prag_stoc: number | string
  furnizor_id: string | null
}

const EMPTY: ProdusForm = {
  nume: '',
  descriere: '',
  unitate_masura: 'buc',
  pret_lei: '',
  cota_tva: 21,
  track_stock: false,
  stoc_curent: 0,
  prag_stoc: '',
  furnizor_id: null
}

const nullify = (s: string): string | null => (s.trim() !== '' ? s.trim() : null)
const numOrNull = (v: number | string): number | null =>
  v === '' || v === null ? null : Number(v)

export function Produse(): React.JSX.Element {
  const { items, loading, error, reload } = useList<Produs>(window.api.produse.list)
  const [furnizori, setFurnizori] = useState<Furnizor[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Produs | null>(null)
  const [opened, { open, close }] = useDisclosure(false)
  const form = useForm<ProdusForm>({
    initialValues: EMPTY,
    validate: { nume: (v) => (v.trim() ? null : 'Numele este obligatoriu') }
  })

  useEffect(() => {
    window.api.furnizori.list().then(setFurnizori)
  }, [])

  const furnizoriOptions = useMemo(
    () => furnizori.map((f) => ({ value: String(f.id), label: f.nume })),
    [furnizori]
  )
  const furnizorNume = useMemo(() => {
    const m = new Map<number, string>()
    for (const f of furnizori) m.set(f.id, f.nume)
    return m
  }, [furnizori])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((p) =>
      [p.nume, p.descriere, p.unitate_masura].some((x) => x?.toLowerCase().includes(q))
    )
  }, [items, search])

  function openCreate(): void {
    setEditing(null)
    form.setValues(EMPTY)
    form.resetDirty(EMPTY)
    open()
  }

  function openEdit(p: Produs): void {
    setEditing(p)
    const vals: ProdusForm = {
      nume: p.nume,
      descriere: p.descriere ?? '',
      unitate_masura: p.unitate_masura,
      pret_lei: p.pret_referinta != null ? baniToLei(p.pret_referinta) : '',
      cota_tva: p.cota_tva,
      track_stock: p.track_stock,
      stoc_curent: p.stoc_curent,
      prag_stoc: p.prag_stoc ?? '',
      furnizor_id: p.furnizor_id != null ? String(p.furnizor_id) : null
    }
    form.setValues(vals)
    form.resetDirty(vals)
    open()
  }

  async function submit(values: ProdusForm): Promise<void> {
    const payload: ProdusInput = {
      nume: values.nume.trim(),
      descriere: nullify(values.descriere),
      unitate_masura: values.unitate_masura.trim() || 'buc',
      pret_referinta: values.pret_lei === '' ? null : leiToBani(Number(values.pret_lei)),
      cota_tva: Number(values.cota_tva),
      track_stock: values.track_stock,
      stoc_curent: values.track_stock ? Number(values.stoc_curent || 0) : 0,
      prag_stoc: values.track_stock ? numOrNull(values.prag_stoc) : null,
      furnizor_id: values.furnizor_id ? Number(values.furnizor_id) : null
    }
    try {
      if (editing) await window.api.produse.update(editing.id, payload)
      else await window.api.produse.create(payload)
      notifications.show({ color: 'teal', title: 'Salvat', message: 'Produsul a fost salvat.' })
      close()
      reload()
    } catch (err) {
      notifications.show({ color: 'red', title: 'Eroare', message: mesajEroare(err) })
    }
  }

  function confirmDelete(p: Produs): void {
    modals.openConfirmModal({
      title: 'Șterge produsul',
      children: (
        <Text size="sm">
          Sigur ștergi produsul <b>{p.nume}</b>? Liniile din comenzi rămân (devin text liber).
        </Text>
      ),
      labels: { confirm: 'Șterge', cancel: 'Renunță' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await window.api.produse.delete(p.id)
          notifications.show({ color: 'gray', title: 'Șters', message: 'Produsul a fost șters.' })
        } catch (err) {
          notifications.show({ color: 'red', title: 'Nu se poate șterge', message: mesajEroare(err) })
        }
        reload()
      }
    })
  }

  return (
    <>
      <PageHeader title="Produse" subtitle="Catalog folosit pentru a pre-completa comenzile" />
      <ListToolbar search={search} onSearch={setSearch} onAdd={openCreate} addLabel="Adaugă produs" />

      {error ? (
        <EroareIncarcare mesaj={error} onRetry={reload} />
      ) : !loading && items.length === 0 ? (
        <ComingSoon
          icon={<IconBox size={34} />}
          title="Niciun produs încă"
          description="Adaugă primul produs cu butonul „Adaugă produs”."
        />
      ) : (
        <Paper withBorder radius="lg">
          <ScrollArea>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={820}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nume</Table.Th>
                  <Table.Th>U.M.</Table.Th>
                  <Table.Th ta="right">Preț referință</Table.Th>
                  <Table.Th ta="center">TVA</Table.Th>
                  <Table.Th ta="right">Stoc</Table.Th>
                  <Table.Th>Furnizor</Table.Th>
                  <Table.Th w={90} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((p) => {
                  const stocScazut =
                    p.track_stock && p.prag_stoc != null && p.stoc_curent <= p.prag_stoc
                  return (
                    <Table.Tr key={p.id} style={{ cursor: 'pointer' }}>
                      <Table.Td onClick={() => openEdit(p)}>
                        <Text fw={500}>{p.nume}</Text>
                      </Table.Td>
                      <Table.Td onClick={() => openEdit(p)}>{p.unitate_masura}</Table.Td>
                      <Table.Td ta="right" onClick={() => openEdit(p)}>
                        {p.pret_referinta != null ? formatLei(p.pret_referinta) : '—'}
                      </Table.Td>
                      <Table.Td ta="center" onClick={() => openEdit(p)}>
                        {p.cota_tva}%
                      </Table.Td>
                      <Table.Td ta="right" onClick={() => openEdit(p)}>
                        {p.track_stock ? (
                          <Group gap={6} justify="flex-end" wrap="nowrap">
                            <span>{p.stoc_curent}</span>
                            {stocScazut && (
                              <Badge size="xs" color="orange" variant="light">
                                scăzut
                              </Badge>
                            )}
                          </Group>
                        ) : (
                          <Text c="dimmed" size="sm">
                            nelimitat
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td onClick={() => openEdit(p)}>
                        {p.furnizor_id != null ? (furnizorNume.get(p.furnizor_id) ?? '—') : '—'}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <ActionIcon variant="subtle" onClick={() => openEdit(p)} aria-label="Editează">
                            <IconPencil size={18} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => confirmDelete(p)}
                            aria-label="Șterge"
                          >
                            <IconTrash size={18} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size="md"
        title={editing ? 'Editează produs' : 'Produs nou'}
      >
        <form onSubmit={form.onSubmit(submit)}>
          <Stack gap="sm">
            <TextInput label="Nume" withAsterisk {...form.getInputProps('nume')} />
            <Textarea
              label="Descriere"
              autosize
              minRows={2}
              {...form.getInputProps('descriere')}
            />
            <Group grow>
              <TextInput label="Unitate de măsură" {...form.getInputProps('unitate_masura')} />
              <Select
                label="Cotă TVA"
                data={[
                  { value: '21', label: '21%' },
                  { value: '11', label: '11%' },
                  { value: '9', label: '9%' },
                  { value: '0', label: '0%' }
                ]}
                value={String(form.values.cota_tva)}
                onChange={(v) => form.setFieldValue('cota_tva', Number(v ?? 21))}
                allowDeselect={false}
              />
            </Group>
            <NumberInput
              label="Preț de referință (lei)"
              description="Orientativ — prețul real se pune pe linia comenzii."
              decimalScale={2}
              fixedDecimalScale
              min={0}
              suffix=" lei"
              {...form.getInputProps('pret_lei')}
            />
            <Select
              label="Furnizor"
              placeholder="Fără furnizor"
              data={furnizoriOptions}
              value={form.values.furnizor_id}
              onChange={(v) => form.setFieldValue('furnizor_id', v)}
              clearable
              searchable
            />
            <Switch
              label="Urmărește stocul"
              description="Achizițiile cresc stocul, vânzările îl scad."
              {...form.getInputProps('track_stock', { type: 'checkbox' })}
            />
            {form.values.track_stock && (
              <Group grow>
                <NumberInput label="Stoc curent" min={0} {...form.getInputProps('stoc_curent')} />
                <NumberInput
                  label="Prag stoc scăzut"
                  min={0}
                  {...form.getInputProps('prag_stoc')}
                />
              </Group>
            )}
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={close}>
                Renunță
              </Button>
              <Button type="submit">Salvează</Button>
            </Group>
          </Stack>
        </form>
        {editing && (
          <div style={{ marginTop: 16 }}>
            <FileAttachments entitateTip="produs" entitateId={editing.id} />
          </div>
        )}
      </Drawer>
    </>
  )
}
