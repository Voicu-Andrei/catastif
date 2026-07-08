import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'
import { Text } from '@mantine/core'
import { modals } from '@mantine/modals'

// Oprește navigarea (meniu lateral, săgeata înapoi etc.) când formularul are
// modificări nesalvate, cu o confirmare clară. Fără asta, un clic greșit
// pierde în tăcere o ofertă întreagă abia introdusă.
export function useGardaNesalvat(dirty: boolean): void {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    modals.openConfirmModal({
      title: 'Modificări nesalvate',
      children: (
        <Text size="sm">
          Ai modificări nesalvate pe această pagină. Dacă pleci acum, ele se pierd.
        </Text>
      ),
      labels: { confirm: 'Pleacă fără să salvezi', cancel: 'Rămâi aici' },
      confirmProps: { color: 'red' },
      onConfirm: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
      onClose: () => {
        if (blocker.state === 'blocked') blocker.reset()
      }
    })
  }, [blocker])
}
