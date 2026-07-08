import { useEffect, useState } from 'react'
import { Badge, Group, Popover, Stack, Text, TextInput, UnstyledButton } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import type { EntitateTip, SearchResult } from '@shared/types'

const TIP_META: Record<EntitateTip, { label: string; color: string }> = {
  produs: { label: 'Produs', color: 'brand' },
  client: { label: 'Client', color: 'grape' },
  furnizor: { label: 'Furnizor', color: 'blue' },
  comanda: { label: 'Comandă', color: 'teal' },
  achizitie: { label: 'Achiziție', color: 'orange' }
}

export function GlobalSearch(): React.JSX.Element {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) {
      setResults([])
      return
    }
    const h = setTimeout(() => {
      window.api.search
        .global(t)
        .then(setResults)
        .catch(() => setResults([]))
    }, 180)
    return () => clearTimeout(h)
  }, [q])

  function go(r: SearchResult): void {
    navigate(r.link)
    setQ('')
    setResults([])
    setOpened(false)
  }

  const show = opened && q.trim().length >= 2 && results.length > 0

  return (
    <Popover opened={show} position="bottom-start" width={420} shadow="md" trapFocus={false}>
      <Popover.Target>
        <TextInput
          placeholder="Caută produse, clienți, furnizori, comenzi…"
          leftSection={<IconSearch size={16} />}
          w={420}
          radius="md"
          value={q}
          onChange={(e) => {
            setQ(e.currentTarget.value)
            setOpened(true)
          }}
          onFocus={() => setOpened(true)}
        />
      </Popover.Target>
      <Popover.Dropdown p={4}>
        <Stack gap={2}>
          {results.map((r) => (
            <UnstyledButton
              key={`${r.tip}-${r.id}`}
              onClick={() => go(r)}
              p="xs"
              style={{ borderRadius: 6 }}
              className="activity-row"
            >
              <Group justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate>
                    {r.titlu}
                  </Text>
                  {r.subtitlu && (
                    <Text size="xs" c="dimmed" truncate>
                      {r.subtitlu}
                    </Text>
                  )}
                </div>
                <Badge size="xs" variant="light" color={TIP_META[r.tip].color}>
                  {TIP_META[r.tip].label}
                </Badge>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
