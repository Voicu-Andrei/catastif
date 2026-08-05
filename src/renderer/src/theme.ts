import { createTheme, type MantineColorsTuple } from '@mantine/core'

// Accent „catastif” — bleumarinul din logo (#172a6f).
// Nuanța 6 este exact culoarea logo-ului (butoane, meniu activ, insigne);
// 0–5 sunt tente pentru fundaluri, 7–9 pentru hover și accente închise.
const brand: MantineColorsTuple = [
  '#f3f4f8',
  '#e3e5ee',
  '#c7ccdc',
  '#a7aec8',
  '#848eb3',
  '#566496',
  '#172a6f',
  '#14245f',
  '#111e50',
  '#0d1840'
]

export const theme = createTheme({
  primaryColor: 'brand',
  colors: { brand },
  defaultRadius: 'md',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  headings: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontWeight: '650'
  }
})
