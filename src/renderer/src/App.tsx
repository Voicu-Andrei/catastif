import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Shell } from './components/AppShell'
import { Dashboard } from './routes/Dashboard'
import { Produse } from './routes/Produse'
import { Clienti } from './routes/Clienti'
import { Furnizori } from './routes/Furnizori'
import { Comenzi } from './routes/Comenzi'
import { ComandaEditor } from './routes/ComandaEditor'
import { Achizitii } from './routes/Achizitii'
import { Facturi } from './routes/Facturi'
import { Rapoarte } from './routes/Rapoarte'
import { Setari } from './routes/Setari'

export function App(): React.JSX.Element {
  const location = useLocation()

  return (
    <Shell>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <Routes location={location}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/produse" element={<Produse />} />
            <Route path="/clienti" element={<Clienti />} />
            <Route path="/furnizori" element={<Furnizori />} />
            <Route path="/comenzi" element={<Comenzi />} />
            <Route path="/comenzi/:id" element={<ComandaEditor />} />
            <Route path="/achizitii" element={<Achizitii />} />
            <Route path="/facturi" element={<Facturi />} />
            <Route path="/rapoarte" element={<Rapoarte />} />
            <Route path="/setari" element={<Setari />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </Shell>
  )
}
