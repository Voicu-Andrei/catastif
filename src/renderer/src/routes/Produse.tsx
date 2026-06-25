import { IconBox } from '@tabler/icons-react'
import { ComingSoon, PageHeader } from '../components/Placeholder'

export function Produse(): React.JSX.Element {
  return (
    <>
      <PageHeader title="Produse" subtitle="Catalog de produse folosit pentru a pre-completa comenzile" />
      <ComingSoon icon={<IconBox size={34} />} title="Produsele sosesc în etapa următoare" />
    </>
  )
}
