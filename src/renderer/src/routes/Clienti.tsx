import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { IconPencil, IconTrash, IconUsers } from '@tabler/icons-react'
import type { Client, ClientInput, TipClient } from '@shared/types'
import { PageHeader, ComingSoon } from '../components/Placeholder'
import { ListToolbar } from '../components/ListToolbar'
import { useList } from '../lib/useList'

const EMPTY: ClientInput = {
  tip: 'persoana',
  nume: '',
  cui: '',
  nr_reg_com: '',
  cnp: '',
  adresa: '',
  judet: '',
  oras: '',
  cod_postal: '',
  telefon: '',
  email: '',
  note: ''
}

const nullify = (s: string | null): string | null => (s && s.trim() !== '' ? s.trim() : null)

export function Clienti(): React.JSX.Element {
  const { items, loading, reload } = useList<Client>(window.api.clienti.list)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Client | null>(null)
  const [opened, { open, close }] = useDisclosure(false)
  const form = useForm<ClientInput>({
    initialValues: EMPTY,
    validate: { nume: (v) => (v.trim() ? null : 'Numele este obligatoriu') }
  })
  const tip = form.values.tip

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((c) =>
      [c.nume, c.cui, c.cnp, c.telefon, c.email, c.oras].some((x) => x?.toLowerCase().includes(q))
    )
  }, [items, search])

  function openCreate(): void {
    setEditing(null)
    form.setValues(EMPTY)
    form.resetDirty(EMPTY)
    open()
  }

  function openEdit(c: Client): void {
    setEditing(c)
    const vals: ClientInput = {
      tip: c.tip,
      nume: c.nume,
      cui: c.cui ?? '',
      nr_reg_com: c.nr_reg_com ?? '',
      cnp: c.cnp ?? '',
      adresa: c.adresa ?? '',
      judet: c.judet ?? '',
      oras: c.oras ?? '',
      cod_postal: c.cod_postal ?? '',
      telefon: c.telefon ?? '',
      email: c.email ?? '',
      note: c.note ?? ''
    }
    form.setValues(vals)
    form.resetDirty(vals)
    open()
  }

  async function submit(values: ClientInput): Promise<void> {
    const esteFirma = values.tip === 'firma'
    const payload: ClientInput = {
      tip: values.tip,
      nume: values.nume.trim(),
      cui: esteFirma ? nullify(values.cui) : null,
      nr_reg_com: esteFirma ? nullify(values.nr_reg_com) : null,
      cnp: esteFirma ? null : nullify(values.cnp),
      adresa: nullify(values.adresa),
      judet: nullify(values.judet),
      oras: nullify(values.oras),
      cod_postal: nullify(values.cod_postal),
      telefon: nullify(values.telefon),
      email: nullify(values.email),
      note: nullify(values.note)
    }
    try {
      if (editing) await window.api.clienti.update(editing.id, payload)
      else await window.api.clienti.create(payload)
      notifications.show({ color: 'teal', title: 'Salvat', message: 'Clientul a fost salvat.' })
      close()
      reload()
    } catch (err) {
      notifications.show({ color: 'red', title: 'Eroare', message: (err as Error).message })
    }
  }

  function confirmDelete(c: Client): void {
    modals.openConfirmModal({
      title: 'Șterge clientul',
      children: (
        <Text size="sm">
          Sigur ștergi clientul <b>{c.nume}</b>?
        </Text>
      ),
      labels: { confirm: 'Șterge', cancel: 'Renunță' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await window.api.clienti.delete(c.id)
          notifications.show({ color: 'gray', title: 'Șters', message: 'Clientul a fost șters.' })
          reload()
        } catch (err) {
          notifications.show({
            color: 'red',
            title: 'Nu se poate șterge',
            message: 'Clientul are comenzi asociate.'
          })
        }
      }
    })
  }

  return (
    <>
      <PageHeader title="Clienți" subtitle="Firme și persoane fizice" />
      <ListToolbar search={search} onSearch={setSearch} onAdd={openCreate} addLabel="Adaugă client" />

      {!loading && items.length === 0 ? (
        <ComingSoon
          icon={<IconUsers size={34} />}
          title="Niciun client încă"
          description="Adaugă primul client cu butonul „Adaugă client”."
        />
      ) : (
        <Paper withBorder radius="lg">
          <ScrollArea>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={760}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nume</Table.Th>
                  <Table.Th>Tip</Table.Th>
                  <Table.Th>CUI / CNP</Table.Th>
                  <Table.Th>Telefon</Table.Th>
                  <Table.Th>Oraș</Table.Th>
                  <Table.Th w={90} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((c) => (
                  <Table.Tr key={c.id} style={{ cursor: 'pointer' }}>
                    <Table.Td onClick={() => openEdit(c)}>
                      <Text fw={500}>{c.nume}</Text>
                    </Table.Td>
                    <Table.Td onClick={() => openEdit(c)}>
                      <Badge variant="light" color={c.tip === 'firma' ? 'blue' : 'grape'}>
                        {c.tip === 'firma' ? 'Firmă' : 'Persoană'}
                      </Badge>
                    </Table.Td>
                    <Table.Td onClick={() => openEdit(c)}>{c.cui ?? c.cnp ?? '—'}</Table.Td>
                    <Table.Td onClick={() => openEdit(c)}>{c.telefon ?? '—'}</Table.Td>
                    <Table.Td onClick={() => openEdit(c)}>{c.oras ?? '—'}</Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <ActionIcon variant="subtle" onClick={() => openEdit(c)} aria-label="Editează">
                          <IconPencil size={18} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => confirmDelete(c)}
                          aria-label="Șterge"
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
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
        title={editing ? 'Editează client' : 'Client nou'}
      >
        <form onSubmit={form.onSubmit(submit)}>
          <Stack gap="sm">
            <SegmentedControl
              fullWidth
              data={[
                { label: 'Persoană fizică', value: 'persoana' },
                { label: 'Firmă', value: 'firma' }
              ]}
              value={tip}
              onChange={(v) => form.setFieldValue('tip', v as TipClient)}
            />
            <TextInput label="Nume" withAsterisk {...form.getInputProps('nume')} />
            {tip === 'firma' ? (
              <Group grow>
                <TextInput label="CUI" {...form.getInputProps('cui')} />
                <TextInput label="Nr. Reg. Com." {...form.getInputProps('nr_reg_com')} />
              </Group>
            ) : (
              <TextInput label="CNP (opțional)" {...form.getInputProps('cnp')} />
            )}
            <TextInput label="Adresă" {...form.getInputProps('adresa')} />
            <Group grow>
              <TextInput label="Oraș" {...form.getInputProps('oras')} />
              <TextInput label="Județ" {...form.getInputProps('judet')} />
              <TextInput label="Cod poștal" {...form.getInputProps('cod_postal')} />
            </Group>
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
      </Drawer>
    </>
  )
}
