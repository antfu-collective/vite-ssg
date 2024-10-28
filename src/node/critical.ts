import type Beasties from 'beasties'
import type { Options } from 'beasties'
import type Critters from 'critters'

export async function getBeastiesOrCritters(outDir: string, options: Options = {}): Promise<Critters | Beasties | undefined> {
  try {
    const BeastiesClass = (await import('beasties')).default

    return new BeastiesClass({
      path: outDir,
      logLevel: 'warn',
      external: true,
      inlineFonts: true,
      preloadFonts: true,
      ...options,
    })
  }
  catch {
  }

  try {
    const CrittersClass = (await import('critters')).default
    console.warn('`critters` is deprecated. Please use `beasties` instead.')
    return new CrittersClass({
      path: outDir,
      logLevel: 'warn',
      external: true,
      inlineFonts: true,
      preloadFonts: true,
      ...options,
    })
  }
  catch {
    return undefined
  }
}
