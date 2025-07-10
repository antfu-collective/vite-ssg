///<reference types="node" />
///<reference types="node/worker_threads" />
import { createRequire } from "node:module";
import { parentPort, workerData } from "node:worker_threads";
import { buildClient, buildServer, CreateAppFactory, CreateTaskFnOptions, ExecuteInWorkerOptions, Manifest, plainify } from "./build";
import { ViteSSGOptions } from "../types";
import { getBeasties } from "./critical";
import { blue, gray, red } from "ansis";
// import type { Options as BeastiesOptions } from "beasties";
import { executeTaskFn } from "./build";
import { resolveConfig } from "vite";
// import type { Options as MinifyOptions } from 'html-minifier-terser'

import Beasties from "beasties";






export interface WorkerDataEntry {  
  workerId: number|string,
  out: string,
  dirStyle: ViteSSGOptions['dirStyle'],  
  mode?: string,  
  viteConfig: {
    configFile?: string
  },  
}


;(async () => {

  
 
  const fnLog = (level: 'info' | 'warn' | 'error' | 'log' | 'trace' | 'debug' = 'info', ...msg:any[]) => {
    const newMsg = msg.map(plainify)
    // if(level === 'error') {
    //   process.stderr.write(`${yellow('[vite-ssg-worker-console]')} ${JSON.stringify(newMsg)}\n`)
      
    // }
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
  const noop = () => void(0)
  
  const proccessInjections = {
    clearLine:noop,
    cursorTo:noop,
    clearScreenDown:noop,
    moveCursor: noop,
    isTTY: false
  };
  Object.assign(process.stdout, proccessInjections)
  Object.assign(process.stderr, proccessInjections)

  const { out, dirStyle, viteConfig, mode, ...extraOpts} = (workerData as WorkerDataEntry)
  const nodeEnv = process.env.NODE_ENV || 'production'  
  const config = await resolveConfig(viteConfig, 'build', mode, nodeEnv)
  const {
    onPageRendered, 
    onBeforePageRender, 
    // onDonePageRender,
  } = config.ssgOptions || {}

  let beasties: Beasties | undefined = undefined

  const { renderToString }: typeof import('vue/server-renderer') = await import('vue/server-renderer')  
  const outDir = out.replace(process.cwd(), '').replace(/^\//g, '')
  const _require = createRequire(import.meta.url)
  

  let createAppPromise:Promise<CreateAppFactory>|undefined = undefined 
  let beastiesPromise:Promise< Beasties | undefined>|undefined = undefined;
  
  const execMap:{
    executeTaskFn: (opts: ExecuteInWorkerOptions) => ReturnType<typeof executeTaskFn>,
    buildClient: typeof buildClient,
    buildServer: typeof buildServer,
  } = {
    executeTaskFn: async (opts: ExecuteInWorkerOptions) => {      
      const { serverEntry } = opts  
      createAppPromise ??= Promise.resolve(import(serverEntry)).then(({createApp}:{createApp:CreateAppFactory}) => createApp)
      const createApp = await createAppPromise      
      const beastiesOptions = opts.beastiesOptions;
      beastiesPromise ??= Promise.resolve(beastiesOptions !== false ? getBeasties(outDir, beastiesOptions) : void 0).then(beasties => {
        if (!beasties) return;
        console.log(`${gray("[vite-ssg]")} ${blue("Critical CSS generation enabled via `beasties`")}`);        
        return beasties
      })        
      const beasties = await beastiesPromise;
      const newOpts: CreateTaskFnOptions = {        
        ...extraOpts,
        out,
        dirStyle,        
        createApp,
        renderToString,
        onPageRendered: onPageRendered,
        onBeforePageRender: onBeforePageRender,
        // onDonePageRender: onDonePageRender,
        beasties,        
        config: {logger: {info: (msg: string) => {
          // config.logger?.info?.(msg)
          parentPort!.postMessage({ type: 'log', args: [msg] })
        }}},
        ...opts,
      }
      return executeTaskFn(newOpts)
    },
    buildClient: async (...args:any[]):Promise<void> => {
      let [_config, _viteConfig] = args
      _config = Object.assign({}, config, _config)
      _viteConfig = Object.assign({}, viteConfig, _viteConfig)
      return await buildClient(_config, _viteConfig)
    },
    buildServer: async (...args:any[]):Promise<void> => {
      let [_config, _viteConfig, _opts] = args
      _config = Object.assign({}, config, _config)
      _viteConfig = Object.assign({}, viteConfig, _viteConfig)
      return await buildServer(_config, _viteConfig, _opts)
    }
  }
  
  parentPort?.on('message', async (message) => {
    const { type, id, args } = message as unknown as {type:string, id:string, args?:any[]}
    if(type in execMap) {
      parentPort!.postMessage(`running ${type}`)
      try{
        // process.stdout.write(JSON.stringify(args))
        // @ts-ignore
        let result = await execMap[type](...(args ?? []))        
        result = plainify(result)        
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

