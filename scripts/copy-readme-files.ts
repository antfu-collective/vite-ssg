import { copyFileSync } from 'node:fs'

const destinations = [
  'multiple-pages',
  'multiple-pages-with-store',
]

destinations.map(ex => `examples/${ex}/README.md`).forEach((ex) => {
  copyFileSync('README.md', ex)
})
