import { Button, Menu } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconDownload, IconFileSpreadsheet, IconFileTypeCsv } from '@tabler/icons-react'
import type { ExportFormat } from '@shared/types'

export function ExportButtons({
  numeFisier,
  headers,
  rows,
  disabled
}: {
  numeFisier: string
  headers: string[]
  rows: (string | number)[][]
  disabled?: boolean
}): React.JSX.Element {
  async function exporta(format: ExportFormat): Promise<void> {
    const r = await window.api.export.tabel(format, numeFisier, headers, rows)
    if (r.ok) {
      notifications.show({ color: 'teal', title: 'Exportat', message: r.cale ?? '' })
    } else if (r.mesaj && r.mesaj !== 'Export anulat.') {
      notifications.show({ color: 'red', title: 'Export eșuat', message: r.mesaj })
    }
  }

  return (
    <Menu shadow="md" position="bottom-end">
      <Menu.Target>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconDownload size={16} />}
          disabled={disabled}
        >
          Exportă
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconFileTypeCsv size={16} />} onClick={() => exporta('csv')}>
          CSV
        </Menu.Item>
        <Menu.Item leftSection={<IconFileSpreadsheet size={16} />} onClick={() => exporta('xlsx')}>
          Excel (.xlsx)
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
