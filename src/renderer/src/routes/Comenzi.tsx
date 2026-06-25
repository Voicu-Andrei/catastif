import { IconClipboardList } from '@tabler/icons-react'
import { ComingSoon, PageHeader } from '../components/Placeholder'

export function Comenzi(): React.JSX.Element {
  return (
    <>
      <PageHeader title="Comenzi" subtitle="Oferte și comenzi, cu profit calculat pe fiecare linie" />
      <ComingSoon icon={<IconClipboardList size={34} />} title="Comenzile sosesc în etapa următoare" />
    </>
  )
}
