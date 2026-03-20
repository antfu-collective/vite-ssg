import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// pnpx changelogithub will change the version before running the build script
const { version } = require('../package.json')

await writeFile(
  './dist/web-types.json',
  JSON.stringify(
    {
      // $schema: 'https://json.schemastore.org/web-types',
      '$schema':
        'https://raw.githubusercontent.com/JetBrains/web-types/master/schema/web-types.json',
      'framework': 'vue',
      'name': 'vite-ssg',
      'version': version,
      'js-types-syntax': 'typescript',
      'description-markup': 'markdown',
      'framework-config': {
        'enable-when': {
          'node-packages': ['vue'],
          'file-extensions': ['vue'],
          'ide-libraries': ['vue'],
        },
      },
      'contributions': {
        html: {
          'vue-components': [
            {
              'name': 'ClientOnly',
              'description':
                'ClientOnly component renders its default slot only at client side.',
              'doc-url':
                'https://github.com/antfu-collective/vite-ssg?tab=readme-ov-file#clientonly',
              'slots': [
                {
                  name: 'default',
                  description: 'Content to render once the ClientOnly component is mounted',
                },
                {
                  name: 'placeholder',
                  description: 'Content to render when ClientOnly is not mounted',
                },
              ],
            },
          ],
        },
      },
    },
    null,
    2,
  ),
  'utf8',
)
