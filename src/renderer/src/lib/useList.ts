import { useCallback, useEffect, useState } from 'react'
import { mesajEroare } from './erori'

// Încarcă o listă și oferă o funcție de reîncărcare. `loader` trebuie să fie stabil
// (ex. window.api.furnizori.list). Erorile nu rămân tăcute: `error` conține
// mesajul pentru utilizator, iar `reload` permite reîncercarea.
export function useList<T>(loader: () => Promise<T[]>): {
  items: T[]
  loading: boolean
  error: string | null
  reload: () => void
} {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    loader()
      .then(setItems)
      .catch((err) => setError(mesajEroare(err)))
      .finally(() => setLoading(false))
  }, [loader])

  useEffect(() => reload(), [reload])

  return { items, loading, error, reload }
}
