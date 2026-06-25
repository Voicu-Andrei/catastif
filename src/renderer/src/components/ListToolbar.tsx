import { Button, Group, TextInput } from '@mantine/core'
import { IconPlus, IconSearch } from '@tabler/icons-react'

export function ListToolbar({
  search,
  onSearch,
  onAdd,
  addLabel
}: {
  search: string
  onSearch: (v: string) => void
  onAdd: () => void
  addLabel: string
}): React.JSX.Element {
  return (
    <Group justify="space-between" mb="md" wrap="nowrap">
      <TextInput
        placeholder="Caută…"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => onSearch(e.currentTarget.value)}
        w={340}
        radius="md"
      />
      <Button leftSection={<IconPlus size={18} />} onClick={onAdd}>
        {addLabel}
      </Button>
    </Group>
  )
}
