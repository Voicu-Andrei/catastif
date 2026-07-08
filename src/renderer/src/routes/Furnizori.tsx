import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Anchor,
  Drawer,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Button
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useSearchParams } from 'react-router-dom'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { IconPencil, IconTrash, IconBuildingWarehouse } from '@tabler/icons-react'
import type { Furnizor, FurnizorInput } from '@shared/types'
import { PageHeader, ComingSoon, EroareIncarcare, ListaSkeleton } from '../components/Placeholder'
import { ListToolbar } from '../components/ListToolbar'
import { FileAttachments } from '../components/FileAttachments'
import { useList } from '../lib/useList'
import { mesajEroare } from '../lib/erori'

const EMPTY: FurnizorInput = {
  nume: '',
  cui: '',
  nr_reg_com: '',
  adresa: '',
  telefon: '',
  email: '',
  note: ''
}

const nullify = (s: string | null): string | null => (s && s.trim() !== '' ? s.trim() : null)

export function Furnizori(): React.JSX.Element {
  const { items, loading, error, reload } = useList<Furnizor>(window.api.furnizori.list)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Furnizor | null>(null)
  const [opened, { open, close }] = useDisclosure(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const form = useForm<FurnizorInput>({
    initialValues: EMPTY,
    validate: { nume: (v) => (v.trim() ? null : 'Numele este obligatoriu') }
  })

  // Deschide direct fișa furnizorului venind din căutarea globală (?edit=<id>).
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || loading) return
    const f = items.find((x) => x.id === Number(editId))
    setSearchParams({}, { replace: true })
    if (f) openEdit(f)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loading, searchParams])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((f) =>
      [f.nume, f.cui, f.telefon, f.email].some((x) => x?.toLowerCase().includes(q))
    )
  }, [items, search])

  function openCreate(): void {
    setEditing(null)
    form.setValues(EMPTY)
    form.resetDirty(EMPTY)
    open()
  }

  function openEdit(f: Furnizor): void {
    setEditing(f)
    const vals: FurnizorInput = {
      nume: f.nume,
      cui: f.cui ?? '',
      nr_reg_com: f.nr_reg_com ?? '',
      adresa: f.adresa ?? '',
      telefon: f.telefon ?? '',
      email: f.email ?? '',
      note: f.note ?? ''
    }
    form.setValues(vals)
    form.resetDirty(vals)
    open()
  }

  async function submit(values: FurnizorInput): Promise<void> {
    const payload: FurnizorInput = {
      nume: values.nume.trim(),
      cui: nullify(values.cui),
      nr_reg_com: nullify(values.nr_reg_com),
      adresa: nullify(values.adresa),
      telefon: nullify(values.telefon),
      email: nullify(values.email),
      note: nullify(values.note)
    }
    try {
      if (editing) await window.api.furnizori.update(editing.id, payload)
      else await window.api.furnizori.create(payload)
      notifications.show({ color: 'teal', title: 'Salvat', message: 'Furnizorul a fost salvat.' })
      close()
      reload()
    } catch (err) {
      notifications.show({ color: 'red', title: 'Eroare', message: mesajEroare(err) })
    }
  }

  function confirmDelete(f: Furnizor): void {
    modals.openConfirmModal({
      title: 'Șterge furnizorul',
      children: (
        <Text size="sm">
          Sigur ștergi furnizorul <b>{f.nume}</b>? Produsele legate vor rămâne, fără furnizor.
        </Text>
      ),
      labels: { confirm: 'Șterge', cancel: 'Renunță' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await window.api.furnizori.delete(f.id)
          notifications.show({ color: 'gray', title: 'Șters', message: 'Furnizorul a fost șters.' })
        } catch (err) {
          notifications.show({
            color: 'red',
            title: 'Nu se poate șterge',
            message: mesajEroare(err)
          })
        }
        reload()
      }
    })
  }

  return (
    <>
      <PageHeader title="Furnizori" subtitle="Persoanele de la care cumpărați" />
      <ListToolbar
        search={search}
        onSearch={setSearch}
        onAdd={openCreate}
        addLabel="Adaugă furnizor"
      />

      {error ? (
        <EroareIncarcare mesaj={error} onRetry={reload} />
      ) : loading ? (
        <ListaSkeleton />
      ) : items.length === 0 ? (
        <ComingSoon
          icon={<IconBuildingWarehouse size={34} />}
          title="Niciun furnizor încă"
          description="Adaugă primul furnizor cu butonul „Adaugă furnizor”."
        />
      ) : (
        <Paper withBorder radius="lg">
          <ScrollArea>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={720}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nume</Table.Th>
                  <Table.Th>CUI</Table.Th>
                  <Table.Th>Telefon</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th w={90} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((f) => (
                  <Table.Tr key={f.id} style={{ cursor: 'pointer' }}>
                    <Table.Td onClick={() => openEdit(f)}>
                      <Text fw={500}>{f.nume}</Text>
                    </Table.Td>
                    <Table.Td onClick={() => openEdit(f)}>{f.cui ?? '—'}</Table.Td>
                    <Table.Td onClick={() => openEdit(f)}>{f.telefon ?? '—'}</Table.Td>
                    <Table.Td onClick={() => openEdit(f)}>
                      {f.email ? <Anchor size="sm">{f.email}</Anchor> : '—'}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => openEdit(f)}
                          aria-label="Editează"
                        >
                          <IconPencil size={18} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => confirmDelete(f)}
                          aria-label="Șterge"
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {filtered.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
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

      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size="md"
        title={editing ? 'Editează furnizor' : 'Furnizor nou'}
      >
        <form onSubmit={form.onSubmit(submit)}>
          <Stack gap="sm">
            <TextInput label="Nume" withAsterisk {...form.getInputProps('nume')} />
            <Group grow>
              <TextInput label="CUI" {...form.getInputProps('cui')} />
              <TextInput label="Nr. Reg. Com." {...form.getInputProps('nr_reg_com')} />
            </Group>
            <TextInput label="Adresă" {...form.getInputProps('adresa')} />
            <Group grow>
              <TextInput label="Telefon" {...form.getInputProps('telefon')} />
              <TextInput label="Email" {...form.getInputProps('email')} />
            </Group>
            <Textarea label="Note" autosize minRows={2} {...form.getInputProps('note')} />
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
            <FileAttachments entitateTip="furnizor" entitateId={editing.id} />
          </div>
        )}
      </Drawer>
    </>
  )
}
