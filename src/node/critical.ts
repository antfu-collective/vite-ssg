import type Critters from 'critters'
import type { Options } from 'critters'

export function getCritters(outDir: string, options: Options = {}): Critters | undefined {
  try {
    // eslint-disable-next-line no-eval
    const CrittersClass = eval('require')('critters') as typeof import('critters').default
    return new CrittersClass({
      external: true,
      inlineFonts: true,
      path: outDir,
      inlineThreshold: Infinity,
      logLevel: 'warn',
      ...options,
    })
  }
  catch (e) {
    return undefined
  }
}
