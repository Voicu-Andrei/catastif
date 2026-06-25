import { IconBuildingWarehouse } from '@tabler/icons-react'
import { ComingSoon, PageHeader } from '../components/Placeholder'

export function Furnizori(): React.JSX.Element {
  return (
    <>
      <PageHeader title="Furnizori" subtitle="Persoanele de la care cumpărați" />
      <ComingSoon
        icon={<IconBuildingWarehouse size={34} />}
        title="Furnizorii sosesc în etapa următoare"
      />
    </>
  )
}
