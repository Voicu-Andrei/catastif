import { AppShell, Group, NavLink, ScrollArea, Text, TextInput, ThemeIcon, Box } from '@mantine/core'
import { Link, useLocation } from 'react-router-dom'
import {
  IconLayoutDashboard,
  IconBox,
  IconUsers,
  IconBuildingWarehouse,
  IconClipboardList,
  IconShoppingCart,
  IconFileInvoice,
  IconChartBar,
  IconSettings,
  IconSearch,
  IconBook2
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { ro } from '../i18n/ro'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

const NAV: NavItem[] = [
  { to: '/', label: ro.nav.acasa, icon: <IconLayoutDashboard size={20} /> },
  { to: '/produse', label: ro.nav.produse, icon: <IconBox size={20} /> },
  { to: '/clienti', label: ro.nav.clienti, icon: <IconUsers size={20} /> },
  { to: '/furnizori', label: ro.nav.furnizori, icon: <IconBuildingWarehouse size={20} /> },
  { to: '/comenzi', label: ro.nav.comenzi, icon: <IconClipboardList size={20} /> },
  { to: '/achizitii', label: ro.nav.achizitii, icon: <IconShoppingCart size={20} /> },
  { to: '/facturi', label: ro.nav.facturi, icon: <IconFileInvoice size={20} /> },
  { to: '/rapoarte', label: ro.nav.rapoarte, icon: <IconChartBar size={20} /> },
  { to: '/setari', label: ro.nav.setari, icon: <IconSettings size={20} /> }
]

export function Shell({ children }: { children: ReactNode }): React.JSX.Element {
  const { pathname } = useLocation()

  const isActive = (to: string): boolean =>
    to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 252, breakpoint: 'sm' }} padding="lg">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <ThemeIcon variant="light" size="lg" radius="md">
              <IconBook2 size={20} />
            </ThemeIcon>
            <Text fw={700} size="lg" style={{ letterSpacing: '-0.02em' }}>
              {ro.appName}
            </Text>
          </Group>
          <TextInput
            placeholder={ro.comun.cauta}
            leftSection={<IconSearch size={16} />}
            w={360}
            radius="md"
            disabled
            description="Căutarea globală sosește în curând"
          />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              component={Link}
              to={item.to}
              label={item.label}
              leftSection={item.icon}
              active={isActive(item.to)}
              variant="light"
              mb={4}
              styles={{ root: { borderRadius: 'var(--mantine-radius-md)' } }}
            />
          ))}
        </AppShell.Section>
        <AppShell.Section>
          <Box px="xs" py="xs">
            <Text size="xs" c="dimmed">
              Catastif — gestiune locală
            </Text>
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
