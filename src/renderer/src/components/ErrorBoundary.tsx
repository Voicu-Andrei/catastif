import { Component, type ReactNode } from 'react'
import { Button, Center, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react'

interface State {
  error: Error | null
}

// Plasă de siguranță: o eroare de randare nu trebuie să lase un ecran alb.
// Datele sunt pe disc — reîncărcarea interfeței este întotdeauna sigură.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error): void {
    console.error('Eroare de interfață:', error)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <Center mih="100vh" p="lg">
        <Paper withBorder radius="lg" p="xl" maw={520}>
          <Stack align="center" gap="sm">
            <ThemeIcon size={64} radius="xl" variant="light" color="red">
              <IconAlertTriangle size={34} />
            </ThemeIcon>
            <Title order={3} ta="center">
              A apărut o problemă în interfață
            </Title>
            <Text c="dimmed" ta="center">
              Datele tale sunt în siguranță pe disc. Reîncarcă aplicația pentru a continua; dacă
              problema persistă, repornește-o.
            </Text>
            <Text size="xs" c="dimmed" ta="center" ff="monospace">
              {this.state.error.message}
            </Text>
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={() => window.location.reload()}
            >
              Reîncarcă aplicația
            </Button>
          </Stack>
        </Paper>
      </Center>
    )
  }
}
