import { Badge, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core'
import {
  IconCash,
  IconClipboardList,
  IconFileText,
  IconPackages,
  IconReportMoney,
  IconSend
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { PageHeader } from '../components/Placeholder'

interface StatProps {
  label: string
  value: string
  icon: ReactNode
  color?: string
  hint?: string
  dezactivat?: boolean
}

function StatCard({ label, value, icon, color = 'brand', hint, dezactivat }: StatProps): React.JSX.Element {
  return (
    <Paper
      withBorder
      radius="lg"
      p="lg"
      style={{ opacity: dezactivat ? 0.6 : 1, transition: 'box-shadow .15s ease, transform .15s ease' }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2}>
          <Text size="sm" c="dimmed">
            {label}
          </Text>
          <Text fz={28} fw={700} style={{ letterSpacing: '-0.03em' }}>
            {value}
          </Text>
          {hint && (
            <Text size="xs" c="dimmed">
              {hint}
            </Text>
          )}
        </Stack>
        <ThemeIcon size={44} radius="md" variant="light" color={color}>
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  )
}

export function Dashboard(): React.JSX.Element {
  return (
    <>
      <PageHeader title="Acasă" subtitle="Starea afacerii dintr-o privire" />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        <StatCard
          label="De încasat"
          value="0,00 lei"
          icon={<IconCash size={24} />}
          hint="Sume rămase de plată pe comenzi"
        />
        <StatCard
          label="Comenzi active"
          value="0"
          icon={<IconClipboardList size={24} />}
          color="blue"
        />
        <StatCard
          label="Oferte în așteptare"
          value="0"
          icon={<IconFileText size={24} />}
          color="grape"
        />
        <StatCard
          label="Profit (luna curentă)"
          value="0,00 lei"
          icon={<IconReportMoney size={24} />}
          color="teal"
        />
        <StatCard
          label="Stoc scăzut"
          value="0"
          icon={<IconPackages size={24} />}
          color="orange"
        />
        <StatCard
          label="Facturi de trimis la ANAF"
          value="—"
          icon={<IconSend size={24} />}
          color="gray"
          hint="e-Factura sosește în curând"
          dezactivat
        />
      </SimpleGrid>

      <Paper withBorder radius="lg" p="lg" mt="lg">
        <Group justify="space-between" mb="xs">
          <Text fw={600}>Activitate recentă</Text>
          <Badge variant="light" color="gray">
            în curând
          </Badge>
        </Group>
        <Text c="dimmed" size="sm">
          Pe măsură ce adaugi clienți, comenzi și plăți, ultimele activități vor apărea aici.
        </Text>
      </Paper>
    </>
  )
}
