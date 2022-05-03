/* eslint-disable no-unused-expressions */
import { bold, gray, red, reset, underline } from 'kolorist'
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
    async (args) => {
      await build(args)
    },
  )
  .fail((msg, err, yargs) => {
    console.error(`\n${gray('[vite-ssg]')} ${bold(red('An internal error occurred.'))}`)
    console.error(`${gray('[vite-ssg]')} ${reset(`Please report an issue, if none already exists: ${underline('https://github.com/antfu/vite-ssg/issues')}`)}`)
    yargs.exit(1, err)
  })
  .showHelpOnFail(false)
  .help()
  .argv
