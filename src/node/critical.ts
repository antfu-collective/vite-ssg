import type Critters from 'critters'
import type { Options } from 'critters'

export async function getCritters(outDir: string, options: Options = {}): Promise<Critters | undefined> {
  try {
    const CrittersClass = (await import('critters')).default

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
