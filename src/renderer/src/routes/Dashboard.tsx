import { useEffect, useState } from 'react'
import { Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import {
  IconCash,
  IconClipboardList,
  IconFileText,
  IconPackages,
  IconReportMoney,
  IconSend,
  IconShoppingCart
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import type { DashboardData } from '@shared/types'
import { PageHeader, EroareIncarcare } from '../components/Placeholder'
import { mesajEroare } from '../lib/erori'
import { formatLei, formatData } from '../lib/format'
import { STARE_META } from '../lib/stare'

interface StatProps {
  label: string
  value: string
  icon: ReactNode
  color?: string
  hint?: string
  onClick?: () => void
  dezactivat?: boolean
}

function StatCard({
  label,
  value,
  icon,
  color = 'brand',
  hint,
  onClick,
  dezactivat
}: StatProps): React.JSX.Element {
  return (
    <UnstyledButton
      onClick={onClick}
      disabled={dezactivat || !onClick}
      style={{ borderRadius: 'var(--mantine-radius-lg)' }}
    >
      <Paper
        withBorder
        radius="lg"
        p="lg"
        style={{
          opacity: dezactivat ? 0.6 : 1,
          cursor: onClick && !dezactivat ? 'pointer' : 'default',
          transition: 'transform .12s ease, box-shadow .12s ease'
        }}
        className="stat-card"
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
    </UnstyledButton>
  )
}

const TIP_ICON: Record<string, ReactNode> = {
  oferta: <IconFileText size={18} />,
  comanda: <IconClipboardList size={18} />,
  anulata: <IconClipboardList size={18} />,
  achizitie: <IconShoppingCart size={18} />
}

export function Dashboard(): React.JSX.Element {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [eroare, setEroare] = useState<string | null>(null)

  useEffect(() => {
    window.api.dashboard
      .get()
      .then(setData)
      .catch((err) => setEroare(mesajEroare(err)))
  }, [])

  const d = data

  if (eroare) {
    return (
      <>
        <PageHeader title="Acasă" subtitle="Starea afacerii dintr-o privire" />
        <EroareIncarcare mesaj={eroare} />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Acasă" subtitle="Starea afacerii dintr-o privire" />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        <StatCard
          label="De încasat"
          value={formatLei(d?.de_incasat ?? 0)}
          icon={<IconCash size={24} />}
          hint="Sume rămase pe comenzi"
          onClick={() => navigate('/comenzi')}
        />
        <StatCard
          label="Comenzi active"
          value={String(d?.comenzi_active ?? 0)}
          icon={<IconClipboardList size={24} />}
          color="blue"
          onClick={() => navigate('/comenzi')}
        />
        <StatCard
          label="Oferte în așteptare"
          value={String(d?.oferte_in_asteptare ?? 0)}
          icon={<IconFileText size={24} />}
          color="grape"
          onClick={() => navigate('/comenzi')}
        />
        <StatCard
          label="Profit (luna curentă)"
          value={formatLei(d?.profit_luna ?? 0)}
          icon={<IconReportMoney size={24} />}
          color="teal"
          onClick={() => navigate('/rapoarte')}
        />
        <StatCard
          label="Stoc scăzut"
          value={String(d?.stoc_scazut ?? 0)}
          icon={<IconPackages size={24} />}
          color="orange"
          onClick={() => navigate('/produse')}
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
        <Text fw={600} mb="sm">
          Activitate recentă
        </Text>
        {!d || d.activitate.length === 0 ? (
          <Text c="dimmed" size="sm">
            Pe măsură ce adaugi comenzi, plăți și achiziții, ultimele activități vor apărea aici.
          </Text>
        ) : (
          <Stack gap={4}>
            {d.activitate.map((a, i) => (
              <UnstyledButton key={i} onClick={() => navigate(a.link)}>
                <Group
                  justify="space-between"
                  wrap="nowrap"
                  p="xs"
                  style={{ borderRadius: 8 }}
                  className="activity-row"
                >
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon
                      size="md"
                      radius="xl"
                      variant="light"
                      color={STARE_META[a.tip as keyof typeof STARE_META]?.color ?? 'gray'}
                    >
                      {TIP_ICON[a.tip] ?? <IconClipboardList size={18} />}
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={500}>
                        {a.titlu}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatData(a.data)}
                      </Text>
                    </div>
                  </Group>
                  {a.suma != null && (
                    <Text size="sm" c="dimmed">
                      {formatLei(a.suma)}
                    </Text>
                  )}
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}
      </Paper>
    </>
  )
}
