
export function getCritters(outDir: string) {
  try {
    // eslint-disable-next-line no-eval
    const Critters = eval('require')('critters') as typeof import('critters').default
    return new Critters({
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
