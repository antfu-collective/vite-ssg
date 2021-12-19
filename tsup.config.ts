import type { Options } from 'tsup'

export default <Options>{
  entryPoints: [
    'src/index.ts',
    'src/client/single-page.ts',
    'src/node/cli.ts',
  ],
  dts: true,
  splitting: true,
  target: 'node14', // needed for working ESM
  format: [
    'esm',
    'cjs',
  ],
  external: [
    'vue',
    'vue/server-renderer',
    'vue/compiler-sfc',
  ],
  clean: true,
}
