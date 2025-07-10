/* eslint-disable no-console */

import type { SSRHeadPayload } from '@unhead/ssr'

import type { InlineConfig, ResolvedConfig } from 'vite'
import type { VitePluginPWAAPI } from 'vite-plugin-pwa'
import type { RouteRecordRaw } from 'vue-router'
import type { SSRContext } from 'vue/server-renderer'
import type { ViteSSGContext, ViteSSGOptions } from '../types'
import type { InjectOptions } from './injection'
import { renderSSRHead } from '@unhead/ssr'
import { injectInHtml } from './injection'
import { buildPreloadLinks } from './preload-links'
import type { Options as MinifyOptions } from 'html-minifier-terser'
import Beasties from 'beasties'
import { BuildWorkerProxy } from './build.worker.proxy'
import { WorkerDataEntry } from './build.worker'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { dirname, isAbsolute, join, parse, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { blue, cyan, dim, gray, green, red, yellow } from 'ansis'
import PQueue from 'p-queue'
import { mergeConfig, resolveConfig, build as viteBuild } from 'vite'
import { serializeState } from '../utils/state'
import { buildLog, getSize, routesToPaths } from './utils'

export type Manifest = Record<string, string[]>

export type CreateAppFactory = (routePath?: string) => Promise<ViteSSGContext<true> | ViteSSGContext<false>>

function DefaultIncludedRoutes(paths: string[], _routes: Readonly<RouteRecordRaw[]>) {
  // ignore dynamic routes
  return paths.filter(i => !i.includes(':') && !i.includes('*'))
}

function getRoot(config: ResolvedConfig) {
  const cwd = process.cwd()
  return config.root || cwd
}

export async function buildClient(config: ResolvedConfig, viteConfig: InlineConfig): Promise<void> {
  const root = getRoot(config)  
  buildLog('Build for client...')
  const { base } = config
  await viteBuild(mergeConfig(viteConfig, {
    base,
    build: {
      ssrManifest: true,
      rollupOptions: {
        input: {
          app: resolve(root, './index.html'),
        },
      },
    },
    mode: config.mode,
  }))
}

export async function buildServer(config: ResolvedConfig, viteConfig: InlineConfig, { ssrEntry, ssgOut, mock }: { ssrEntry: string, ssgOut: string, mock: boolean }): Promise<void> {
  buildLog('Build for server...')
  process.env.VITE_SSG = 'true'
  const { base } = config

   // load jsdom before building the SSR and so jsdom will be available
   if (mock) {
    // @ts-expect-error just ignore it
    const { jsdomGlobal }: { jsdomGlobal: () => void } = await import('./jsdomGlobal.mjs')
    jsdomGlobal()
  }

  await viteBuild(mergeConfig(viteConfig, {
    base,
    build: {
      ssr: ssrEntry,
      outDir: ssgOut,
      minify: false,
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          entryFileNames: '[name].mjs',
          format: 'esm',
        },
      },
    },
    mode: config.mode,
    ssr: {
      noExternal: ['vite-ssg'],
    },
  }))
}

function createProxy(options:WorkerDataEntry ):BuildWorkerProxy {
  const workerExt = '.mjs'
  const workerProxy = new BuildWorkerProxy(new URL(`./build.worker${workerExt}`, import.meta.url), {
    env: process.env,
    workerData: options,
  })
  process.on('SIGINT', workerProxy.terminate.bind(workerProxy))
  process.on('SIGTERM', workerProxy.terminate.bind(workerProxy))
  process.on('SIGBREAK', workerProxy.terminate.bind(workerProxy))  
  process.on('beforeExit', workerProxy.terminate.bind(workerProxy))
  process.on('exit', workerProxy.terminate.bind(workerProxy))
  return workerProxy
}

export async function build(ssgOptions: Partial<ViteSSGOptions & { 'skip-build'?: boolean }> = {}, viteConfig: InlineConfig = {}) {
  const nodeEnv = process.env.NODE_ENV || 'production'
  const mode = process.env.MODE || ssgOptions.mode || nodeEnv  
  const config = await resolveConfig(viteConfig, 'build', mode, nodeEnv)


  const root = getRoot(config)
  const outDir = config.build.outDir || 'dist'
  const out = isAbsolute(outDir) ? outDir : join(root, outDir)
    

  const {
    script = 'sync',
    mock = false,
    entry = await detectEntry(root),
    ssgOut: _ssgOutDir = join(root, '.vite-ssg-temp', Math.random().toString(36).substring(2, 12)),
    formatting = 'none',
    minifyOptions = {},
    // crittersOptions = {},
    beastiesOptions = {},
    includedRoutes: configIncludedRoutes = DefaultIncludedRoutes,
    // onBeforePageRender,
    // onPageRendered,
    // onDonePageRender,
    numberOfWorkers:_numberOfWorkers = 5,
    onFinished,
    dirStyle = 'flat',
    includeAllRoutes = false,    
    concurrency = 20,
    rootContainerId = 'app',
  }: ViteSSGOptions = Object.assign({}, config.ssgOptions || {}, ssgOptions)

  const ssgOut = isAbsolute(_ssgOutDir) ? _ssgOutDir : join(root, _ssgOutDir)  
  
  
  const createProxyOptions:Omit<Parameters<typeof createProxy>[0], 'workerId'> = {    
    out,
    dirStyle,    
    viteConfig: {
      configFile: config.configFile,
    } ,
  };
  


  let willRunBuild: boolean = true
  if (existsSync(ssgOut)) {
    willRunBuild = !ssgOptions['skip-build']
    if (willRunBuild) {      
      await fs.rm(ssgOut, { recursive: true })
    }
  }

  const buildPromises:Promise<any>[] = []

  // client
  if (willRunBuild){
    const clientWorker = createProxy({
      ...createProxyOptions,
      workerId: 'client',
    })
    // await buildClient(config, viteConfig)
    const cpBuildClient =  execInWorker(clientWorker, buildClient, config, viteConfig).finally(() => clientWorker.terminate())
    buildPromises.push(cpBuildClient)
  }

  // server
  const ssrEntry = await resolveAlias(config, entry)
  if (willRunBuild) {
    // await buildServer(config, viteConfig, { ssrEntry, ssgOut, format })
    const serverWorker = createProxy({
      ...createProxyOptions,
      workerId: 'server',
    })
    const cpBuildServer = execInWorker(serverWorker, buildServer, config, viteConfig, { ssrEntry, ssgOut, mock }).finally(() => serverWorker.terminate())
    buildPromises.push(cpBuildServer)
  }
  await Promise.all(buildPromises)

  const serverEntry = pathToFileURL(resolve(ssgOut, `${parse(ssrEntry).name}.mjs`)).href
  const {
    createApp,
    includedRoutes: serverEntryIncludedRoutes,
  }: {
    createApp: CreateAppFactory
    includedRoutes: ViteSSGOptions['includedRoutes']
  } = await import(serverEntry)


  /** initialize workers */
  const numberOfWorkers = Math.max(1,  _numberOfWorkers)
  console.log(`${gray('[vite-ssg]')} ${blue(`Using ${numberOfWorkers} workers`)}`)
  const workers = Array.from({length: numberOfWorkers}, (_, index) => createProxy({
    ...createProxyOptions,
    workerId: index,    
  }))
  const terminateWorkers = () => {
    workers.splice(0, workers.length).forEach(worker => worker.terminate())
  }

  let workerIndex = 0
  const maxTasksPerWorker = Math.ceil(concurrency / numberOfWorkers)
  const workersInUse: Map<BuildWorkerProxy, Promise<any>[]> = new Map()
  const workerTasksRunning = (w: BuildWorkerProxy) => workersInUse.get(w)?.length || 0
  const selectIdleWorker = () => workers.filter(w => workerTasksRunning(w) < maxTasksPerWorker).sort((a, b) => workerTasksRunning(a) - workerTasksRunning(b))[0]
  const selectWorker = async (workerIndex?: number) => {
    const index = workerIndex ?? (Math.round(Math.random() * numberOfWorkers))
    const maybeWorker = workers[index % numberOfWorkers]
    const worker = maybeWorker && workerTasksRunning(maybeWorker) < maxTasksPerWorker ? maybeWorker : selectIdleWorker()
    if(!worker) {
      await Promise.race(Array.from(workersInUse.values()).flat())
      return selectWorker(workerIndex)
    }
    const workerPromises = workersInUse.get(worker) || []
    const delayPromise = new Promise(resolve => setImmediate(resolve))
    workersInUse.set(worker, [...workerPromises, delayPromise])
    delayPromise.finally(() => {
      workerPromises.splice(workerPromises.indexOf(delayPromise), 1)
      workersInUse.set(worker, workerPromises)
    })    
    return worker
  }
  /** end of workers initialization */
  


  const includedRoutes = serverEntryIncludedRoutes || configIncludedRoutes
  const { routes } = await createApp()

  let routesPaths = includeAllRoutes
    ? routesToPaths(routes)
    : await includedRoutes(routesToPaths(routes), routes || [])

  // uniq
  routesPaths = Array.from(new Set(routesPaths))

  buildLog('Rendering Pages...', routesPaths.length)


  const {
    path: _ssrManifestPath,
    content: ssrManifestRaw,
  } = await readFiles(
    resolve(out, '.vite', 'ssr-manifest.json'), // Vite 5
    resolve(out, 'ssr-manifest.json'), // Vite 4 and below
  )
  const ssrManifest: Manifest = JSON.parse(ssrManifestRaw)
  let indexHTML = await fs.readFile(resolve(out, 'index.html'), 'utf-8')
  indexHTML = rewriteScripts(indexHTML, script)
  const IS_PROD = nodeEnv === 'production'  
  indexHTML = await formatHtml(indexHTML, IS_PROD ? 'minify' : formatting, minifyOptions)

  // const { renderToString }: typeof import('vue/server-renderer') = await import('vue/server-renderer')

  const queue = new PQueue({ concurrency })
 
  for (const route of routesPaths) {
    await queue.onSizeLessThan(concurrency) // avoid grow the number of tasks in queue
    queue.add(async () => {  
      const workerProxy = await selectWorker(workerIndex ++ % numberOfWorkers)
      
      let retryCount = 0
      const maxRetries = 3
      const execOpts:ExecuteInWorkerOptions = {      
          route,
          ssrManifest,
          indexHTML,
          rootContainerId,
          formatting,
          minifyOptions,
          // out,
          // dirStyle,
          beastiesOptions,          
          serverEntry,
      
      }
      const taskPromise = executeTaskInWorker(workerProxy, execOpts).catch(e => {
        if ( (retryCount++) < maxRetries) {          
          console.log(`${gray('[vite-ssg]')} ${yellow(`Retrying ${retryCount} of ${maxRetries} for route: ${cyan(route)}`)}`)
          return executeTaskInWorker(workerProxy, execOpts)
        }
        throw e
      })
      const workerPromises = workersInUse.get(workerProxy) || []
      workersInUse.set(workerProxy, workerPromises)
      taskPromise.finally(() => {
        workerPromises.splice(workerPromises.indexOf(taskPromise), 1)
        workersInUse.set(workerProxy, workerPromises)
      })
      return taskPromise//.then(({ route, html, appCtx }) => onDonePageRender?.(route, html, appCtx))
    })
  }

  await queue.start().onIdle()
  terminateWorkers();

  if (!ssgOptions['skip-build']) {
    await fs.rm(ssgOut, { recursive: true })
  }

  // when `vite-plugin-pwa` is presented, use it to regenerate SW after rendering
  const pwaPlugin: VitePluginPWAAPI = config.plugins.find(i => i.name === 'vite-plugin-pwa')?.api
  if (pwaPlugin && !pwaPlugin.disabled && pwaPlugin.generateSW) {
    buildLog('Regenerate PWA...')
    await pwaPlugin.generateSW()
  }

  console.log(`\n${gray('[vite-ssg]')} ${green('Build finished.')}`)

  await onFinished?.()

  // ensure build process always exits
  const waitInSeconds = 15
  const timeout = setTimeout(() => {
    console.log(`${gray('[vite-ssg]')} ${yellow(`Build process still running after ${waitInSeconds}s. There might be something misconfigured in your setup. Force exit.`)}`)
    process.exit(0)
  }, waitInSeconds * 1000)
  timeout.unref() // don't wait for timeout
}



export interface ExecuteInWorkerOptions {  
  route: string  
  serverEntry: string
  ssrManifest: Manifest 
  indexHTML: string    
  rootContainerId: string
  formatting: ViteSSGOptions['formatting']
  beastiesOptions: ViteSSGOptions['beastiesOptions'] | false
  minifyOptions: MinifyOptions  
  // out: string
  // dirStyle: ViteSSGOptions['dirStyle']   
}


function executeTaskInWorker(worker: BuildWorkerProxy, opts: ExecuteInWorkerOptions) {
 return execInWorker(worker, executeTaskFn, opts)
}


export async function execInWorker<T extends (...args:any[]) => any>(worker: BuildWorkerProxy, fn:T, ...args:any[]) : Promise<Awaited<ReturnType<T>>> {
  //@ts-ignore
  return await worker.send(fn.name, plainify(args ?? [])) as Awaited<ReturnType<T>>
}


export interface CreateTaskFnOptions extends Omit<ExecuteInWorkerOptions, 'beastiesOptions'> {  
  out: string
  dirStyle: ViteSSGOptions['dirStyle']
  createApp: CreateAppFactory
  renderToString: typeof import('vue/server-renderer')['renderToString']  
  // onDonePageRender?: ViteSSGOptions['onDonePageRender']
  onBeforePageRender?: ViteSSGOptions['onBeforePageRender']
  onPageRendered?: ViteSSGOptions['onPageRendered']  
  beasties: Beasties | undefined
  config: {logger: {info: (msg: string) => void}}
}

export async function executeTaskFn(opts: CreateTaskFnOptions) {
  const {
    route, 
    createApp, 
    renderToString, 
    indexHTML, 
    onBeforePageRender, 
    // onDonePageRender, 
    onPageRendered, 
    ssrManifest, 
    rootContainerId, 
    formatting, 
    minifyOptions, 
    beasties, 
    out, 
    dirStyle, 
    config
  } = opts
  try {
    const appCtx = await createApp(route) as ViteSSGContext<true>
    const { app, router, head, initialState, triggerOnSSRAppRendered, transformState = serializeState } = appCtx

    if (router) {
      await router.push(route)
      await router.isReady()
    }

    const transformedIndexHTML = (await onBeforePageRender?.(route, indexHTML, appCtx)) || indexHTML

    const ctx: SSRContext = {}
    const appHTML = await renderToString(app, ctx)
    await triggerOnSSRAppRendered?.(route, appHTML, appCtx)
    // need to resolve assets so render content first

    /** replace slower jsdom to use unhead/ssr and injectInHtml utils */
    // render current page's preloadLinks
    const preloads:string[] = buildPreloadLinks({ html: transformedIndexHTML }, ctx.modules || new Set<string>(), ssrManifest)
    let ssrHead = {
      headTags: preloads.join("\n"),
      bodyAttrs: '',
      htmlAttrs: '',
      bodyTagsOpen: '',
      bodyTags: '',
    }
    if (head) {
      const tmpSSrHead = await renderSSRHead(head as any)
      ssrHead = Object.assign(tmpSSrHead, {
        headTags: [tmpSSrHead.headTags.trim(), ssrHead.headTags].filter(x => !!x).join("\n"),
      })
    }

    const html = await renderHTML({
      rootContainerId,
      indexHTML: transformedIndexHTML,
      appHTML,
      initialState: transformState(initialState),
      ssrHead,
      teleports: ctx.teleports,
    })

    let transformed = (await onPageRendered?.(route, html, appCtx)) || html
    if (beasties)
      transformed = await beasties.process(transformed)

    const formatted = await formatHtml(transformed, formatting, {
      collapseWhitespace : false,
      collapseInlineTagWhitespace : false,
      ...minifyOptions
    })

    const relativeRouteFile = `${(route.endsWith('/')
      ? `${route}index`
      : route).replace(/^\//g, '')}.html`

    const filename = dirStyle === 'nested'
      ? join(route.replace(/^\//g, ''), 'index.html')
      : relativeRouteFile

    await fs.mkdir(join(out, dirname(filename)), { recursive: true })
    return fs.writeFile(join(out, filename), formatted, 'utf-8').then(() => {
      const outDir = out.replace(process.cwd(), '').replace(/^\//,'')
      config.logger.info(
        `${dim(`${outDir}/`)}${cyan(filename.padEnd(15, ' '))}  ${dim(getSize(formatted))}`,
      )      
      return { route, html }
    })

  }
  catch (err: any) {
    throw new Error(`${gray('[vite-ssg]')} ${red(`Error on page: ${cyan(route)}`)}\n${err.stack}`)
  }
}

export function plainify(m: any):any {    
  if(m instanceof Function) {
    return undefined
  }
  if (Array.isArray(m)) {
    return m.map(plainify)
  }
  if (typeof m === 'object' && m !== null) {
    if(m instanceof Error || 'stack' in m){
      return {
        message: m.message,
        stack: m.stack,
      }
    }

    return Object.entries(m).reduce((acc, [key, value]) => {
      acc[key] = plainify(value)
      return acc
    }, {} as Record<string, any>)
  }
  return m
}


async function detectEntry(root: string) {
  // pick the first script tag of type module as the entry
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const scriptSrcReg = /<script.*?src=["'](.+?)["'](?!<).*>\s*<\/script>/gi
  const html = await fs.readFile(join(root, 'index.html'), 'utf-8')
  const scripts = [...html.matchAll(scriptSrcReg)]
  const [, entry] = scripts.find((matchResult) => {
    const [script] = matchResult
    const [, scriptType] = script.match(/.*\stype=(?:'|")?([^>'"\s]+)/i) || []
    return scriptType === 'module'
  }) || []
  return entry || 'src/main.ts'
}

async function resolveAlias(config: ResolvedConfig, entry: string) {
  const resolver = config.createResolver()
  const result = await resolver(entry, config.root)
  return result || resolve(config.root, entry)
}

function rewriteScripts(indexHTML: string, mode?: string) {
  if (!mode || mode === 'sync')
    return indexHTML
  return indexHTML.replace(/<script type="module" /g, `<script type="module" ${mode} `)
}

async function renderHTML({
  rootContainerId,
  indexHTML,
  appHTML,
  initialState,
  ssrHead,
  teleports,
}: {
  rootContainerId: string
  indexHTML: string
  appHTML: string
  initialState: any
  ssrHead: SSRHeadPayload
  teleports?: Record<string, string>
},
) {
  // const regex = new RegExp(`<\\w+(?:[-\\w])?\\s*id\\s*=\\s*("|')${rootContainerId}\\1`)
  // if (!regex.test(indexHTML)) {
  //   throw new Error(`Could not find a tag with id="${rootContainerId}" to replace it with server-side rendered HTML`)
  // }
  const teleportInjections: InjectOptions[] = Object.entries(teleports ?? {}).map(([sel, value]) => {
    let match: any = {}
    /** match id class and tag but only simple selectors */
    const tagMatch = sel.match(/^[\w-]+/)
    const idMatch = sel.match(/#([\w-]+)/)
    const classMatch = sel.match(/\.([\w-]+)/)
    if (tagMatch) {
      match = { ...match, tag: tagMatch[0] }
    }
    if (idMatch) {
      match = { ...match, attr: { id: idMatch[1] } }
    }
    if (classMatch) {
      match = { ...match, attr: { class: new RegExp(`\b${classMatch[1]}\b`) } }
    }
    return { match, append: value }
  })

  const stateScript = initialState ? `\n<script>window.__INITIAL_STATE__=${initialState}<\/script>\n` : ''
  const injectOptions: InjectOptions[] = [
    { match: { tag: 'html' }, attrs: ssrHead.htmlAttrs },
    { match: { tag: 'head' }, prepend: ssrHead.headTags, removeChildren: [{ tag: 'title' }] },
    ...teleportInjections,
    { match: { tag: 'body' }, attrs: ssrHead.bodyAttrs, prepend: ssrHead.bodyTagsOpen, append: ssrHead.bodyTags },
    {
      match: {
        attr: { id: rootContainerId },
      },
      throwException: true,
      attrs: 'data-server-rendered="true"',
      append: appHTML,
      after: stateScript,
    },
  ]

  try {
    return injectInHtml(indexHTML, injectOptions)
  }
  catch (_e: any) {
    throw new Error(`Could not find a tag with id="${rootContainerId}" to replace it with server-side rendered HTML ${_e.toString()}`)
  }
}

async function formatHtml(html: string, formatting: ViteSSGOptions['formatting'], opts: MinifyOptions = {}) {
  if (formatting === 'minify') {
    const htmlMinifier = await import('html-minifier-terser')
    return await htmlMinifier.minify(html, {
      collapseWhitespace: true,
      caseSensitive: true,
      collapseInlineTagWhitespace: false,
      minifyJS: true,
      minifyCSS: true,
      ...opts,
    })
  }
  else if (formatting === 'prettify') {
    const prettier = (await import('prettier')).default
    return await prettier.format(html, { semi: false, parser: 'html' })
  }
  return html
}

async function readFiles(...paths: string[]) {
  for (const path of paths) {
    if (existsSync(path)) {
      return {
        path,
        content: await fs.readFile(path, 'utf-8'),
      }
    }
  }
  throw new Error(`Could not find any of the following files: ${paths.join(', ')}`)
}
