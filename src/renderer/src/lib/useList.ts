import { useCallback, useEffect, useState } from 'react'

// Încarcă o listă și oferă o funcție de reîncărcare. `loader` trebuie să fie stabil
// (ex. window.api.furnizori.list).
export function useList<T>(loader: () => Promise<T[]>): {
  items: T[]
  loading: boolean
  reload: () => void
} {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    loader()
      .then(setItems)
      .finally(() => setLoading(false))
  }, [loader])

  useEffect(() => reload(), [reload])

  return { items, loading, reload }
}
