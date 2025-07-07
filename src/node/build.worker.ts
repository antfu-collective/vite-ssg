///<reference types="node" />
///<reference types="node/worker_threads" />
import { createRequire } from "node:module";
import { parentPort, workerData } from "node:worker_threads";
import { CreateAppFactory, CreateTaskFnOptions, ExecuteInWorkerOptions, Manifest } from "./build";
import { ViteSSGOptions } from "vite-ssg";
import { getBeastiesOrCritters } from "./critical";
import { blue, gray, red, yellow } from "kolorist";
import type { Options as BeastiesOptions } from "beasties";
import { executeTaskFn } from "./build";
import { resolveConfig } from "vite";
import type { Options as MinifyOptions } from 'html-minifier-terser'





export interface WorkerDataEntry {
  serverEntry: string
  workerId: number|string,
  format: 'esm' | 'cjs',
  out: string,
  dirStyle: ViteSSGOptions['dirStyle'],
  beastiesOptions: BeastiesOptions|false,
  mode?: string,
  ssrManifest: Manifest,
  indexHTML: string
  rootContainerId: string
  formatting: ViteSSGOptions['formatting']
  minifyOptions: MinifyOptions  
  viteConfig: {
    configFile?: string
  },  
}


;(async () => {

  const plainnify = (m: any):any => {
    
    if(m instanceof Function) {
      return undefined
    }
    if (Array.isArray(m)) {
      return m.map(plainnify)
    }
    if (typeof m === 'object' && m !== null) {
      if(m instanceof Error || 'stack' in m){
        return {
          message: m.message,
          stack: m.stack,
        }
      }

      return Object.entries(m).reduce((acc, [key, value]) => {
        acc[key] = plainnify(value)
        return acc
      }, {} as Record<string, any>)
    }
    return m?.toString()
  }
 
  const fnLog = (level: 'info' | 'warn' | 'error' | 'log' | 'trace' | 'debug' = 'info', ...msg:any[]) => {
    const newMsg = msg.map(plainnify)
    if(level === 'error') {
      process.stderr.write(`${yellow('[vite-ssg-worker-console]')} ${JSON.stringify(newMsg)}\n`)
      
    }
    parentPort!.postMessage({ type: 'log', args: newMsg, level })
  }
  globalThis.console = Object.assign(globalThis.console, {
    info: fnLog.bind(globalThis.console, 'info'),
    warn: fnLog.bind(globalThis.console, 'warn'),
    error: fnLog.bind(globalThis.console, 'error'),
    log: fnLog.bind(globalThis.console, 'log'),
    trace: fnLog.bind(globalThis.console, 'trace'),
    debug: fnLog.bind(globalThis.console, 'debug'),
  })

  const {serverEntry,  out, beastiesOptions, viteConfig, mode, format, dirStyle, ...extraOpts} = (workerData as WorkerDataEntry)
  const nodeEnv = process.env.NODE_ENV || 'production'  
  const config = await resolveConfig(viteConfig, 'build', mode, nodeEnv)
  const {
    onPageRendered, 
    onBeforePageRender, 
    onDonePageRender,
  } = config.ssgOptions || {}

  const { renderToString }: typeof import('vue/server-renderer') = await import('vue/server-renderer')  
  const outDir = out.replace(process.cwd(), '').replace(/^\//g, '')
  const _require = createRequire(import.meta.url)
  const beasties = beastiesOptions !== false
    ? await getBeastiesOrCritters(outDir, beastiesOptions)
    : undefined
  if (beasties)
    console.log(`${gray('[vite-ssg]')} ${blue('Critical CSS generation enabled via `beasties`')}`)

  const { createApp }: { createApp: CreateAppFactory } = format === 'esm'
    ? await import(serverEntry)
    : _require(serverEntry)
  // const logger = createWokerLoggerDelegate(parentPort!)
  // globalThis.console = Object.assign(globalThis.console, logger)
  

  // const onPageRendered:ViteSSGOptions['onPageRendered'] = async (route: string, renderedHTML: string, appCtx: ViteSSGContext<true>):Promise<any> => {
  //   parentPort!.postMessage({ type: 'pageRendered',  args: [route, renderedHTML, appCtx] })
  //   return;    
  // }
  // const onBeforePageRender:ViteSSGOptions['onBeforePageRender'] = async (route: string, indexHTML: string, appCtx: ViteSSGContext<true>):Promise<any> => {
  //   parentPort!.postMessage({ type: 'beforePageRender',  args: [route, indexHTML, appCtx] })
  //   return;    
  // }
  const execMap = {
    executeTaskFn: async (opts: ExecuteInWorkerOptions) => {
      const newOpts: CreateTaskFnOptions = {        
        ...extraOpts,
        out,
        dirStyle,        
        createApp,
        renderToString,
        onPageRendered: onPageRendered,
        onBeforePageRender: onBeforePageRender,
        onDonePageRender: onDonePageRender,
        beasties,        
        config: {logger: {info: (msg: string) => {
          // config.logger?.info?.(msg)
          parentPort!.postMessage({ type: 'log', args: [msg] })
        }}},
        ...opts,
      }
      return executeTaskFn(newOpts)
    },
  }
  
  parentPort?.on('message', async (message) => {
    const { type, id, args } = message as unknown as {type:string, id:string, args?:any[]}
    if(type in execMap) {
      parentPort!.postMessage(`running ${type}`)
      try{
        // process.stdout.write(JSON.stringify(args))
        // @ts-ignore
        const result = await execMap[type](...(args ?? []))        
        if(result.appCtx) {
          Object.assign(result, {
            appCtx: result.appCtx.router.push(result.route)
          })
        }
        
        
        parentPort!.postMessage({ type: 'result', id, result })
      }
      catch(e:any) {
        const message = e.message || e.toString()
        const stack = e.stack || ''
        const error = {message, stack}
        process.stderr.write(`${red('[vite-ssg-worker]')} ${message} ${stack}\n`)
        parentPort!.postMessage({ type: 'error', id, error })
      }
    }
  })
})();