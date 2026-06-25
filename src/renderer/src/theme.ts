import { createTheme, type MantineColorsTuple } from '@mantine/core'

// Accent „catastif” — verde-petrol (vibe de registru/contabilitate), calm și profesional.
const brand: MantineColorsTuple = [
  '#e6fbf6',
  '#d3f0e9',
  '#a9dfd2',
  '#7bcdba',
  '#56bda6',
  '#3fb399',
  '#2fae92',
  '#1d987e',
  '#0c876f',
  '#00745e'
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
