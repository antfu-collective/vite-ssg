import process from 'node:process'
import { bold, gray, red, yellow } from 'ansis'
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
  .action(async (args) => {
    const { config: configFile = undefined, ...ssgOptions } = args
    if (args.script && !['sync', 'async', 'defer', 'async defer'].includes(args.script)) {
      console.error(`\n${gray('[vite-ssg]')} ${bold(red('Invalid script option.'))}`)
      process.exit(1)
    }
    await build(ssgOptions, { configFile })

    // ensure build process always exits
    const waitInSeconds = 15
    const timeout = setTimeout(() => {
      console.log(`${gray('[vite-ssg]')} ${yellow(`Build process still running after ${waitInSeconds}s. There might be something misconfigured in your setup. Force exit.`)}`)
      process.exit(0)
    }, waitInSeconds * 1000)
    timeout.unref() // don't wait for timeout
  })

cli.on('command:*', () => {
  console.error(`\n${gray('[vite-ssg]')} ${bold(red('Invalid command.'))}`)
  cli.outputHelp()
  process.exit(1)
})

cli.help()
cli.parse(process.argv)

export {}
