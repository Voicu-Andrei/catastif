import { useEffect, useState } from 'react'
import { Button, Group, Modal, Stack, Text } from '@mantine/core'

export function UpdateNotifier(): React.JSX.Element {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => window.api.update.onAvailable(({ version }) => setVersion(version)), [])

  function respond(r: 'da' | 'nu' | 'skip'): void {
    window.api.update.respond(r)
    setVersion(null)
  }

  return (
    <Modal
      opened={version !== null}
      onClose={() => respond('nu')}
      title="Actualizare disponibilă"
      centered
    >
      <Stack>
        <Text>
          O versiune nouă{version ? ` (${version})` : ''} a aplicației Catastif este disponibilă.
          Vrei să actualizezi acum?
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" color="gray" onClick={() => respond('skip')}>
            Nu pentru această versiune
          </Button>
          <Button variant="default" onClick={() => respond('nu')}>
            Nu
          </Button>
          <Button onClick={() => respond('da')}>Da, actualizează</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
