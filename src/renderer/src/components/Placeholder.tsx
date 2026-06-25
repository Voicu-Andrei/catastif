import { Center, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  action
}: {
  title: ReactNode
  subtitle?: string
  action?: ReactNode
}): React.JSX.Element {
  return (
    <Group justify="space-between" align="flex-end" mb="lg" wrap="nowrap">
      <div>
        <Title order={2} style={{ letterSpacing: '-0.02em' }}>
          {title}
        </Title>
        {subtitle && (
          <Text c="dimmed" size="sm" mt={2}>
            {subtitle}
          </Text>
        )}
      </div>
      {action}
    </Group>
  )
}

export function ComingSoon({
  icon,
  title,
  description
}: {
  icon: ReactNode
  title: string
  description?: string
}): React.JSX.Element {
  return (
    <Paper withBorder radius="lg" p="xl">
      <Center mih={300}>
        <Stack align="center" gap="sm">
          <ThemeIcon size={64} radius="xl" variant="light" color="gray">
            {icon}
          </ThemeIcon>
          <Title order={3} ta="center">
            {title}
          </Title>
          <Text c="dimmed" ta="center" maw={440}>
            {description ?? 'Această secțiune este în dezvoltare și va fi disponibilă în curând.'}
          </Text>
        </Stack>
      </Center>
    </Paper>
  )
}
