import process from 'node:process'
import { bold, gray, red } from 'ansis'
import { cac } from 'cac'
import { build } from './build'

const cli = cac('vite-ssg')

cli
  .command('build', 'Build SSG')
  .option('--script <script>', 'Rewrites script loading timing')
  .option('--mock', 'Mock browser globals (window, document, etc.) for SSG')
  .option('--mode <mode>', 'Specify the mode the Vite process is running in')
  .option('--config, -c <config>', 'The vite config file to use')
  .option('--base, -b <base>', 'The base path to render')
  .option('--skip-build', 'Skip build if already have build in ssg-out dir')
  .action(async (args) => {
    const { config: configFile = undefined, ...ssgOptions } = args
    if (args.script && !['sync', 'async', 'defer', 'async defer'].includes(args.script)) {
      console.error(`\n${gray('[vite-ssg]')} ${bold(red('Invalid script option.'))}`)
      process.exit(1)
    }
    await build(ssgOptions, { configFile })
  })

cli.on('command:*', () => {
  console.error(`\n${gray('[vite-ssg]')} ${bold(red('Invalid command.'))}`)
  cli.outputHelp()
  process.exit(1)
})

cli.help()
cli.parse(process.argv)

export {}
