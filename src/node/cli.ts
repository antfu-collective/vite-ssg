/* eslint-disable no-unused-expressions */
import chalk from 'chalk'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { build } from './build'

yargs(hideBin(process.argv))
  .scriptName('vite-ssg')
  .usage('$0 [args]')
  .command(
    'build',
    'Build SSG',
    args => args
      .option('script', {
        choices: ['sync', 'async', 'defer', 'async defer'] as const,
        describe: 'Rewrites script loading timing',
      })
      .option('mock', {
        type: 'boolean',
        describe: 'Mock browser globals (window, document, etc.) for SSG',
      }),
    async(args) => {
      await build(args)
    },
  )
  .fail((msg, err, yargs) => {
    console.error(`\n${chalk.gray('[vite-ssg]')} ${chalk.red.bold('An internal error occurred.')}`)
    console.error(`${chalk.gray('[vite-ssg]')} ${chalk.white(`Please report an issue, if none already exists: ${chalk.underline('https://github.com/antfu/vite-ssg/issues')}`)}`)
    yargs.exit(1, err)
  })
  .showHelpOnFail(false)
  .help()
  .argv
