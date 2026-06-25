import { IconFileInvoice } from '@tabler/icons-react'
import { Badge, Group } from '@mantine/core'
import { ComingSoon, PageHeader } from '../components/Placeholder'

export function Facturi(): React.JSX.Element {
  return (
    <>
      <PageHeader
        title={
          <Group gap="sm" align="center">
            <span>Facturi</span>
            <Badge variant="light" color="gray" radius="sm">
              în curând
            </Badge>
          </Group>
        }
        subtitle="e-Factura (RO_CIUS) — generarea XML va fi adăugată într-o versiune viitoare"
      />
      <ComingSoon
        icon={<IconFileInvoice size={34} />}
        title="e-Factura sosește într-o versiune viitoare"
        description="Aplicația păstrează deja toate câmpurile fiscale necesare. Generarea fișierului XML (RO_CIUS / UBL 2.1) și fluxul de trimitere vor fi adăugate ulterior. Aplicația nu va gestiona niciodată datele tale de autentificare ANAF."
      />
    </>
  )
}
