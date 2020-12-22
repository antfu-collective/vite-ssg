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
          type: 'string',
          default: 'sync' as 'defer' | 'async' | 'sync',
          choices: ['defer', 'async', 'sync'],
          describe: 'Rewrites script loading timing',
        })
        .option('mock', {
          type: 'boolean',
          default: false,
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
