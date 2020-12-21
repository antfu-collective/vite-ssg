import { build } from './build'

const command = process.argv[1]

if (command === 'build') {
  build()
    .catch(console.error)
    .then(() => process.exit(0))
}
else {
  console.log('Usage: vite-ssg build')
  process.exit(1)
}
