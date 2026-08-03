import { useEffect, useRef, useState } from 'react'
import { Button, Group, Modal, Progress, Stack, Text } from '@mantine/core'
import type { InfoActualizare } from '@shared/types'

const INITIAL: InfoActualizare = {
  stare: { faza: 'inactiv' },
  versiuneIgnorata: null,
  versiuneDescarcata: null
}

// Fereastra de actualizare urmărește starea din procesul principal, în loc să
// țină minte singură ce s-a întâmplat. Așa, o interfață care pornește mai încet
// decât prima verificare nu pierde anunțul: la montare cere starea curentă.
export function UpdateNotifier(): React.JSX.Element {
  const [info, setInfo] = useState<InfoActualizare>(INITIAL)
  const primitPush = useRef(false)

  useEffect(() => {
    // Abonarea vine prima: dacă între cerere și răspuns sosește un anunț mai
    // nou, instantaneul întârziat nu are voie să-l dea înapoi.
    const dezabonare = window.api.update.onState((i) => {
      primitPush.current = true
      setInfo(i)
    })
    window.api.update.state().then((i) => {
      if (!primitPush.current) setInfo(i)
    })
    return dezabonare
  }, [])

  const stare = info.stare

  function inchide(): void {
    setInfo((precedent) => ({ ...precedent, stare: { faza: 'inactiv' } }))
  }

  // Verificările de rutină și starea „la zi” nu merită o fereastră modală —
  // ele apar doar în Setări, unde utilizatorul le-a cerut explicit.
  const vizibil =
    stare.faza === 'disponibila' || stare.faza === 'descarcare' || stare.faza === 'descarcata'

  const inDescarcare = stare.faza === 'descarcare'

  return (
    <Modal
      opened={vizibil}
      onClose={() => {
        if (stare.faza === 'disponibila') window.api.update.respond('nu')
        // Închiderea ferestrei nu trebuie să lase procesul principal blocat pe
        // „descarcata” — starea din care nicio verificare nu mai pornește — în
        // timp ce interfața crede că s-a terminat. O tratăm ca pe alegerea „la
        // următoarea închidere”, ceea ce și este: actualizarea descărcată se
        // instalează oricum la închidere, iar butonul din Setări rămâne acolo.
        if (stare.faza === 'descarcata') window.api.update.install('la_inchidere')
        inchide()
      }}
      title="Actualizare disponibilă"
      centered
      // În timpul descărcării nu are rost să poată fi închisă din greșeală —
      // inclusiv cu Escape, altfel s-ar redeschide la următorul pas de progres.
      closeOnClickOutside={!inDescarcare}
      closeOnEscape={!inDescarcare}
      withCloseButton={!inDescarcare}
    >
      {stare.faza === 'disponibila' && (
        <Stack>
          <Text>
            O versiune nouă ({stare.versiune}) a aplicației Catastif este disponibilă. Datele tale
            rămân neatinse — actualizarea schimbă doar aplicația.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                window.api.update.respond('skip')
                inchide()
              }}
            >
              Nu pentru această versiune
            </Button>
            <Button
              variant="default"
              onClick={() => {
                window.api.update.respond('nu')
                inchide()
              }}
            >
              Mai târziu
            </Button>
            <Button onClick={() => window.api.update.respond('da')}>Da, actualizează</Button>
          </Group>
        </Stack>
      )}

      {stare.faza === 'descarcare' && (
        <Stack>
          <Text>Se descarcă versiunea {stare.versiune}…</Text>
          <Progress value={stare.procent} animated />
          <Text size="sm" c="dimmed">
            {stare.procent}% — poți continua să lucrezi. Te anunțăm când e gata.
          </Text>
          {/* Fără butonul ăsta, o descărcare blocată (proxy de firmă, legătură
              moartă) ar lăsa fereastra pe ecran, fără nicio ieșire. */}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => window.api.update.cancel()}>
              Renunță la descărcare
            </Button>
          </Group>
        </Stack>
      )}

      {stare.faza === 'descarcata' && (
        <Stack>
          <Text>
            Versiunea {stare.versiune} este descărcată și gata de instalare. Aplicația se va
            reporni.
          </Text>
          <Text size="sm" c="dimmed">
            Dacă ai ceva nesalvat, alege „La următoarea închidere” și salvează întâi.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button
              variant="default"
              onClick={() => {
                window.api.update.install('la_inchidere')
                inchide()
              }}
            >
              La următoarea închidere
            </Button>
            <Button onClick={() => window.api.update.install('acum')}>Repornește acum</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
