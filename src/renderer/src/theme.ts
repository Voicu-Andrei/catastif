import { createTheme, NumberInput, type MantineColorsTuple } from '@mantine/core'

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
  },
  components: {
    // Pe o tastatură românească din Windows, tasta zecimală de pe blocul numeric
    // scrie virgulă. Fără asta, „12,50” pur și simplu nu se putea tasta nicăieri
    // în aplicație — deși chiar textele indicative spuneau „0,00”. Setat aici, o
    // dată, ca să fie valabil și pentru câmpurile adăugate mai târziu.
    NumberInput: NumberInput.extend({
      defaultProps: { decimalSeparator: ',' }
    })
  }
})
