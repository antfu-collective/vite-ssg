import type Critters from 'critters'
import type { Options } from 'critters'

export function getCritters(outDir: string, options: Options = {}): Critters | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const CrittersClass = require('critters') as typeof import('critters').default
    return new CrittersClass({
      path: outDir,
      logLevel: 'warn',
      external: true,
      inlineFonts: true,
      preloadFonts: true,
      ...options,
    })
  }
  catch (e) {
    return undefined
  }
}
