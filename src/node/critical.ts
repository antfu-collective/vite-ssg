import type Beasties from 'beasties'
import type { Options } from 'beasties'

export async function getBeasties(outDir: string, options: Options = {}): Promise<Beasties | undefined> {
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
}
