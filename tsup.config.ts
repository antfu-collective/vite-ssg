import { Options } from 'tsup'

export default <Options>{
  entryPoints: [
    'src/index.ts',
    'src/client/single-page.ts',
    'src/node/cli.ts',
    'src/node/utils.ts'
  ],
  dts: true,
  splitting: true,
  format: [
    'esm',
    'cjs',
  ],
  external: [
    'vue',
    'vue/server-renderer',
    'vue/compiler-sfc',
    'ava'
  ],
  clean: true,
}
