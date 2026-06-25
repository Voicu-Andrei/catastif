import { IconShoppingCart } from '@tabler/icons-react'
import { ComingSoon, PageHeader } from '../components/Placeholder'

export function Achizitii(): React.JSX.Element {
  return (
    <>
      <PageHeader title="Achiziții" subtitle="Cumpărări de la furnizori și istoricul costurilor" />
      <ComingSoon icon={<IconShoppingCart size={34} />} title="Achizițiile sosesc în etapa următoare" />
    </>
  )
}
