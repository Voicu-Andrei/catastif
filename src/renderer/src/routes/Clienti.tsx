import { IconUsers } from '@tabler/icons-react'
import { ComingSoon, PageHeader } from '../components/Placeholder'

export function Clienti(): React.JSX.Element {
  return (
    <>
      <PageHeader title="Clienți" subtitle="Firme și persoane fizice" />
      <ComingSoon icon={<IconUsers size={34} />} title="Clienții sosesc în etapa următoare" />
    </>
  )
}
