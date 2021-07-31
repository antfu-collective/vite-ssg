import type Critters from 'critters'

export function getCritters(outDir: string): Critters | undefined {
  try {
    // eslint-disable-next-line no-eval
    const CrittersClass = eval('require')('critters')
    return new CrittersClass({
      external: false,
      path: outDir,
      inlineThreshold: Infinity,
      logLevel: 'warn',
    })
  }
  catch (e) {
    return undefined
  }
}
