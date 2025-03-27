import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    { input: 'src/app/client', name: 'client' },
    { input: 'src/app/server', name: 'server' },
    { input: 'src/node/cli', name: 'node/cli' },
    { input: 'src/node', name: 'node' },
  ],
  clean: true,
  declaration: true,
  externals: [
    'vue',
    'vue/server-renderer',
    'vue/compiler-sfc',
  ],
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
