import fs from 'fs'

const destinations = [
  'multiple-pages',
  'multiple-pages-with-store',
]

destinations.map(ex => `examples/${ex}/README.md`).forEach((ex) => {
  fs.copyFileSync('README.md', ex)
})
