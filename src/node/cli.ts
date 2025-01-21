import process from 'node:process'
import { bold, gray, green, red, reset, underline } from 'kolorist'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { build } from './build'
import { promisify } from 'node:util'
import { ChildProcess, spawn as doSpawn } from 'node:child_process'
import { join } from 'node:path'

const subProcessSet = new Set<ChildProcess>();

// eslint-disable-next-line ts/no-unused-expressions
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
      })
      .option('config', {
        alias: 'c',
        type: 'string',
        describe: 'The vite config file to use',
      })
      .option('base', {
        alias: 'b',
        type: 'string',
        describe: 'The base path to render',
      })
      .option('skip-build', {
        type: 'boolean',
        describe: 'Skip build if already have build in ssg-out dir',
      })
      .option('build-only',{
        type: 'boolean',
        describe: "Build Server and client files, but not generate"
      }).
      option('ssgOut', {
        type: 'string',
        describe: 'SSR production build folder'
      }),
    async (args) => {
      if (process.env.IS_CHILD) {
        const { config: configFile = void 0, ...ssgOptions } = args;
        await build(ssgOptions, { configFile });
      } else {
        const ssgOut = args.ssgOut ?? join(".vite-ssg-temp", Math.random().toString(36).substring(2, 12));      
        
        const _args = process.argv.slice(1);      
        
        await spawn(process.argv0, [..._args, '--build-only', '1'], { IS_CHILD: "1", SSG_OUT:ssgOut  });
        await spawn(process.argv0, [..._args, '--skip-build', '1'], { IS_CHILD: "1", SSG_OUT:ssgOut  });
      }
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

export {}




/**
 * @param  command
 */
export async function spawn(command: string, args: string[], env?: Record<string, string|undefined>) {  
  const envStr = Object.entries(env || {}).reduce((acc,[key,value]) => {
    return `${acc} ${key}='${value}' `
  }, '');
  console.info(`SPAWN: ${envStr} ${command} ${args.join(' ')}`)

  type CallbackFunctionT = (err: null | string, result: { stdout: string, stderr: string }) => void
  function fnDoSpawnWithCallback(command: string, cb: CallbackFunctionT) {
    // console.log(command)

    const subprocess = doSpawn(command, args, {
      cwd: process.cwd(),
      env: { ...env ?? {}, ...process.env },
    })
    subProcessSet.add(subprocess)
    const encoding = 'utf-8'
    let bufStdErr = Buffer.alloc(0, '', encoding)
    let bufStdOut = Buffer.alloc(0, '', encoding)    
    subprocess.stdout?.on('data', (data: Buffer) => {      
      data.toString(encoding).split(/\n/).forEach((line) => {
        line = `${line}\n`
        if (line.startsWith('[')){
          line = green(line)          
        }

        process.stderr.write(line)
      })
      bufStdOut = data      
    })
    subprocess.stderr?.on('data', (data: Buffer) => {
      bufStdErr = data
      data.toString(encoding).split(/\n/).forEach((line) => {
        line = `${line}\n`
        if (line.startsWith('[')) {
          line = red(line)
        }
        process.stderr.write(line)
      })
    })   

    subprocess.on('close', (code:any) => {
      const stdout = `${bufStdOut.toString(encoding)}`
      const stderr = `${bufStdErr.toString(encoding)}`
      const result = { stderr, stdout }
      subProcessSet.delete(subprocess)
      if (code !== 0) {
        if(code === null){
          const errLine = red(new Error('Process killed').message);
          process.stderr.write(errLine)        
        }
        return cb(`error code ${code} \n ${subprocess.stderr?.read()}`, result)
      }
      return cb(null, result)
    })
  }

  return await promisify(fnDoSpawnWithCallback)(command)

};
