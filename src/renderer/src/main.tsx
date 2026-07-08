import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { HashRouter } from 'react-router-dom'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/charts/styles.css'
import './index.css'

import { theme } from './theme'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <ErrorBoundary>
        <ModalsProvider>
          <Notifications position="top-right" />
          <HashRouter>
            <App />
          </HashRouter>
        </ModalsProvider>
      </ErrorBoundary>
    </MantineProvider>
  </React.StrictMode>
)
