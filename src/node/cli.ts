/* eslint-disable no-unused-expressions */
import yargs from 'yargs'
import { build } from './build'

yargs
  .scriptName('vite-ssg')
  .usage('$0 [args]')
  .command(
    'build',
    'Build SSG',
    (args) => {
      return args
        .option('script', {
          choices: ['defer', 'async', 'sync'] as const,
          describe: 'Rewrites script loading timing',
        })
        .option('mock', {
          type: 'boolean',
          describe: 'Mock browser globals (window, document, etc.) for SSG',
        })
    },
    (args) => {
      build(args)
        .catch((err) => {
          console.error(err)
          process.exit(1)
        })
        .then(() => {
          process.exit(0)
        })
    },
  )
  .showHelpOnFail(false)
  .help()
  .argv
