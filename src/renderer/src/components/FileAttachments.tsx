import { useCallback, useEffect, useState } from 'react'
import { ActionIcon, Button, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconFile, IconPaperclip, IconTrash } from '@tabler/icons-react'
import type { EntitateTip, Fisier } from '@shared/types'
import { formatMarime } from '../lib/format'
import { mesajEroare } from '../lib/erori'

export function FileAttachments({
  entitateTip,
  entitateId
}: {
  entitateTip: EntitateTip
  entitateId: number
}): React.JSX.Element {
  const [fisiere, setFisiere] = useState<Fisier[]>([])

  const reload = useCallback(() => {
    window.api.fisiere
      .list(entitateTip, entitateId)
      .then(setFisiere)
      .catch((err) =>
        notifications.show({ color: 'red', title: 'Eroare', message: mesajEroare(err) })
      )
  }, [entitateTip, entitateId])

  useEffect(() => reload(), [reload])

  async function adauga(): Promise<void> {
    try {
      const lista = await window.api.fisiere.attach(entitateTip, entitateId)
      setFisiere(lista)
    } catch (err) {
      notifications.show({ color: 'red', title: 'Eroare la atașare', message: mesajEroare(err) })
    }
  }

  function sterge(f: Fisier): void {
    modals.openConfirmModal({
      title: 'Șterge fișierul',
      children: (
        <Text size="sm">
          Sigur ștergi <b>{f.nume}</b>? Fișierul va fi eliminat din folderul aplicației.
        </Text>
      ),
      labels: { confirm: 'Șterge', cancel: 'Renunță' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await window.api.fisiere.delete(f.id)
        } catch (err) {
          notifications.show({ color: 'red', title: 'Eroare', message: mesajEroare(err) })
        }
        reload()
      }
    })
  }

  return (
    <Paper withBorder radius="lg" p="lg">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Fișiere</Text>
        <Button size="xs" variant="light" leftSection={<IconPaperclip size={16} />} onClick={adauga}>
          Atașează
        </Button>
      </Group>
      {fisiere.length === 0 ? (
        <Text c="dimmed" size="sm">
          Niciun fișier atașat. Adaugă desene, contracte sau poze.
        </Text>
      ) : (
        <Stack gap={4}>
          {fisiere.map((f) => (
            <Group
              key={f.id}
              justify="space-between"
              wrap="nowrap"
              p="xs"
              style={{ borderRadius: 6 }}
              className="activity-row"
            >
              <Group
                gap="sm"
                wrap="nowrap"
                style={{ cursor: 'pointer', minWidth: 0 }}
                onClick={() => window.api.fisiere.open(f.id)}
              >
                <ThemeIcon variant="light" color="gray" radius="md">
                  <IconFile size={18} />
                </ThemeIcon>
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" truncate>
                    {f.nume}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatMarime(f.marime)}
                  </Text>
                </div>
              </Group>
              <ActionIcon variant="subtle" color="red" onClick={() => sterge(f)} aria-label="Șterge">
                <IconTrash size={18} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      )}
    </Paper>
  )
}
