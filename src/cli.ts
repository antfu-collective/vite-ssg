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
    },
    (args) => {
      build(args)
        .catch(console.error)
        .then(() => process.exit(0))
    },
  )
  .showHelpOnFail(false)
  .help()
  .argv
