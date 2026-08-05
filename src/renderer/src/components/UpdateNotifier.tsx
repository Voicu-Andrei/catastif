import { useEffect, useState } from 'react'
import { Button, Group, Modal, Stack, Text } from '@mantine/core'

export function UpdateNotifier(): React.JSX.Element {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    // Ascultăm anunțul…
    const desubscrie = window.api.update.onAvailable(({ version }) => setVersion(version))
    // …dar întrebăm și noi, în caz că verificarea s-a terminat înainte ca
    // această componentă să existe. Altfel anunțul s-ar pierde definitiv.
    window.api.update
      .pending()
      .then((info) => info && setVersion(info.version))
      .catch(() => undefined)
    return desubscrie
  }, [])

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
