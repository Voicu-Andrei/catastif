import { IconChartBar } from '@tabler/icons-react'
import { ComingSoon, PageHeader } from '../components/Placeholder'

export function Rapoarte(): React.JSX.Element {
  return (
    <>
      <PageHeader title="Rapoarte" subtitle="Profit, vânzări și încasări, cu export" />
      <ComingSoon
        icon={<IconChartBar size={34} />}
        title="Rapoartele sosesc într-o etapă următoare"
        description="Profit și vânzări pe perioadă, client și produs, cu grafice și export CSV / Excel / PDF."
      />
    </>
  )
}
