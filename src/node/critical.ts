import type Critters from 'critters'
import type { Options } from 'critters'

export async function getCritters(outDir: string, options: Options = {}): Promise<Critters | undefined> {
  try {
    const CrittersClass = (await import('critters')).default

    // temporary workaround for: https://github.com/GoogleChromeLabs/critters/issues/94
    const fs = await import('fs')

    // Critters.readFile() somehow accepts this.fs and uses it instead of require('fs'). The latter throws an error, because require() is not available in ESM.
    class CrittersClassWithFS extends CrittersClass {
      fs: typeof fs

      constructor(...args: ConstructorParameters<typeof CrittersClass>) {
        super(...args)
        this.fs = fs
      }
    }

    return new CrittersClassWithFS({
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
