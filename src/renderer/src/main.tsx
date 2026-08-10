import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications, notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { createHashRouter, RouterProvider } from 'react-router-dom'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/charts/styles.css'
import './index.css'

import { theme } from './theme'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { mesajEroare } from './lib/erori'

// ErrorBoundary prinde doar erorile apărute în timpul randării. Un apel IPC
// respins într-un handler de buton trece pe lângă el și, fără linia asta, nu
// lasă nicio urmă pe ecran: utilizatorul apasă „Salvează”, nu se întâmplă
// nimic și crede că a salvat.
window.addEventListener('unhandledrejection', (ev) => {
  ev.preventDefault()
  notifications.show({ color: 'red', title: 'Eroare', message: mesajEroare(ev.reason) })
})

// Router „de date” (createHashRouter): permite blocarea navigării cu
// modificări nesalvate (useBlocker). Rutele propriu-zise rămân în App.
const router = createHashRouter([{ path: '*', element: <App /> }])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <ErrorBoundary>
        <ModalsProvider>
          <Notifications position="top-right" />
          <RouterProvider router={router} />
        </ModalsProvider>
      </ErrorBoundary>
    </MantineProvider>
  </React.StrictMode>
)
