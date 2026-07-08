import { useEffect, useState } from 'react'
import {
  Button,
  Divider,
  Group,
  LoadingOverlay,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import {
  IconDeviceFloppy,
  IconDownload,
  IconFolder,
  IconFolderOpen,
  IconRestore
} from '@tabler/icons-react'
import type { Setari as TSetari } from '@shared/types'
import { PageHeader } from '../components/Placeholder'
import { mesajEroare } from '../lib/erori'
import { TVA_SELECT_DATA } from '../lib/tva'
import { invalidateSetari } from '../lib/useSetari'

const INITIAL: TSetari = {
  nume_firma: '',
  cui: '',
  nr_reg_com: '',
  adresa: '',
  judet: '',
  oras: '',
  cod_postal: '',
  iban: '',
  telefon: '',
  email: '',
  logo_path: null,
  cota_tva_implicita: 21,
  serie_factura: 'CTF',
  numar_factura_curent: 1,
  backup_folder: null,
  auto_backup: false,
  prag_stoc_implicit: 5,
  versiune_ignorata: null
}

export function Setari(): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const form = useForm<TSetari>({ initialValues: INITIAL })

  useEffect(() => {
    window.api.setari
      .get()
      .then((s) => {
        form.setValues(s)
        form.resetDirty(s)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(values: TSetari): Promise<void> {
    setSaving(true)
    try {
      const payload: Partial<TSetari> = {
        ...values,
        cota_tva_implicita: Number(values.cota_tva_implicita),
        numar_factura_curent: Number(values.numar_factura_curent),
        prag_stoc_implicit: Number(values.prag_stoc_implicit)
      }
      const saved = await window.api.setari.save(payload)
      invalidateSetari()
      form.resetDirty(saved)
      notifications.show({ color: 'teal', title: 'Salvat', message: 'Setările au fost salvate.' })
    } catch (err) {
      notifications.show({ color: 'red', title: 'Eroare', message: mesajEroare(err) })
    } finally {
      setSaving(false)
    }
  }

  async function alegeFolderBackup(): Promise<void> {
    const folder = await window.api.backup.chooseFolder()
    if (folder) form.setFieldValue('backup_folder', folder)
  }

  async function backupAcum(): Promise<void> {
    const res = await window.api.backup.exportNow()
    if (res.ok) {
      notifications.show({
        color: 'teal',
        title: 'Backup creat',
        message: res.cale ?? 'Backup realizat cu succes.'
      })
      // reflectă folderul ales (dacă a fost ales la prima rulare)
      const s = await window.api.setari.get()
      form.setFieldValue('backup_folder', s.backup_folder)
    } else {
      notifications.show({ color: 'red', title: 'Backup eșuat', message: res.mesaj ?? 'Eroare' })
    }
  }

  function confirmaRestaurare(): void {
    modals.openConfirmModal({
      title: 'Restaurează din backup',
      children: (
        <Text size="sm">
          Datele curente vor fi <b>înlocuite</b> cu cele din backupul ales, iar aplicația se va
          reporni. Continui?
        </Text>
      ),
      labels: { confirm: 'Restaurează și repornește', cancel: 'Renunță' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const res = await window.api.backup.importFrom()
        if (!res.ok) {
          notifications.show({
            color: 'red',
            title: 'Restaurare eșuată',
            message: res.mesaj ?? 'Eroare'
          })
        }
      }
    })
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <PageHeader
        title="Setări"
        subtitle="Datele firmei, TVA și backup"
        action={
          <Button
            type="submit"
            leftSection={<IconDeviceFloppy size={18} />}
            loading={saving}
            disabled={!form.isDirty()}
          >
            Salvează
          </Button>
        }
      />

      <Stack gap="lg" pos="relative">
        <LoadingOverlay visible={loading} />

        {/* Date firmă */}
        <Paper withBorder radius="lg" p="lg">
          <Title order={4} mb="md">
            Datele firmei
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            Apar pe documentele tipărite și vor fi folosite la e-Factura.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput label="Nume firmă" {...form.getInputProps('nume_firma')} />
            <TextInput label="CUI" {...form.getInputProps('cui')} />
            <TextInput label="Nr. Reg. Com." {...form.getInputProps('nr_reg_com')} />
            <TextInput label="IBAN" {...form.getInputProps('iban')} />
            <TextInput label="Adresă" {...form.getInputProps('adresa')} />
            <TextInput label="Oraș" {...form.getInputProps('oras')} />
            <TextInput label="Județ" {...form.getInputProps('judet')} />
            <TextInput label="Cod poștal" {...form.getInputProps('cod_postal')} />
            <TextInput label="Telefon" {...form.getInputProps('telefon')} />
            <TextInput label="Email" {...form.getInputProps('email')} />
          </SimpleGrid>
        </Paper>

        {/* TVA și facturare */}
        <Paper withBorder radius="lg" p="lg">
          <Title order={4} mb="md">
            TVA și facturare
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Select
              label="Cotă TVA implicită"
              data={TVA_SELECT_DATA}
              value={String(form.values.cota_tva_implicita)}
              onChange={(v) => form.setFieldValue('cota_tva_implicita', Number(v ?? 21))}
              allowDeselect={false}
            />
            <TextInput label="Serie factură" {...form.getInputProps('serie_factura')} />
            <NumberInput
              label="Următorul număr factură"
              min={1}
              {...form.getInputProps('numar_factura_curent')}
            />
          </SimpleGrid>
          <Divider my="md" />
          <NumberInput
            label="Prag implicit stoc scăzut"
            description="Folosit pentru produsele cu stoc urmărit care nu au un prag propriu."
            min={0}
            w={260}
            {...form.getInputProps('prag_stoc_implicit')}
          />
        </Paper>

        {/* Backup */}
        <Paper withBorder radius="lg" p="lg">
          <Title order={4} mb="xs">
            Backup și restaurare
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            Întreaga afacere stă într-un singur fișier. Fă backup regulat — un laptop stricat nu
            trebuie să șteargă afacerea.
          </Text>

          <Group align="flex-end" gap="sm" mb="md" wrap="wrap">
            <TextInput
              label="Folder backup"
              placeholder="Niciun folder ales"
              readOnly
              value={form.values.backup_folder ?? ''}
              w={420}
            />
            <Button
              variant="default"
              leftSection={<IconFolder size={18} />}
              onClick={alegeFolderBackup}
            >
              Alege folder
            </Button>
            <Button
              variant="default"
              leftSection={<IconFolderOpen size={18} />}
              onClick={() => window.api.backup.openFolder()}
              disabled={!form.values.backup_folder}
            >
              Deschide folder
            </Button>
          </Group>

          <Switch
            label="Backup automat la închiderea aplicației"
            description="Salvează o copie în folderul de mai sus de fiecare dată când închizi aplicația."
            mb="md"
            {...form.getInputProps('auto_backup', { type: 'checkbox' })}
          />

          <Group gap="sm">
            <Button leftSection={<IconDownload size={18} />} onClick={backupAcum}>
              Creează backup acum
            </Button>
            <Button
              variant="light"
              color="red"
              leftSection={<IconRestore size={18} />}
              onClick={confirmaRestaurare}
            >
              Restaurează din backup
            </Button>
          </Group>
        </Paper>
      </Stack>
    </form>
  )
}
