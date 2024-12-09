/* eslint-disable no-console */
import { dirname, isAbsolute, join, parse } from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import PQueue from 'p-queue'
import { blue, cyan, dim, gray, green, red, yellow } from 'kolorist'
import fs from 'fs-extra'
import type { InlineConfig, ResolvedConfig } from 'vite'
import { mergeConfig, resolveConfig, build as viteBuild } from 'vite'
import type { SSRContext } from 'vue/server-renderer'
import { JSDOM } from 'jsdom'
import type { VitePluginPWAAPI } from 'vite-plugin-pwa'
import type { RouteRecordRaw } from 'vue-router'

import type { SSRHeadPayload } from '@unhead/ssr'
import { renderSSRHead } from '@unhead/ssr'
import type { ViteSSGContext, ViteSSGOptions } from '../types'
import { serializeState } from '../utils/state'
import { buildPreloadLinks } from './preload-links'
import type { InjectOptions } from './utils'
import { buildLog, getSize, injectInHtml, routesToPaths } from './utils'
import { getCritters } from './critical'

export type Manifest = Record<string, string[]>

export type CreateAppFactory = (client: boolean, routePath?: string) => Promise<ViteSSGContext<true> | ViteSSGContext<false>>

function DefaultIncludedRoutes(paths: string[], _routes: Readonly<RouteRecordRaw[]>) {
  // ignore dynamic routes
  return paths.filter(i => !i.includes(':') && !i.includes('*'))
}

function getRoot(config: ResolvedConfig) {
  const cwd = process.cwd()
  return config.root || cwd
}

async function buildClient(config: ResolvedConfig, viteConfig: InlineConfig): Promise<void> {
  const root = getRoot(config)
  buildLog('Build for client...')
  const { base } = config
  await viteBuild(mergeConfig(viteConfig, {
    base,
    build: {
      ssrManifest: true,
      rollupOptions: {
        input: {
          app: join(root, './index.html'),
        },
      },
    },
    mode: config.mode,
  }))
}

async function buildServer(config: ResolvedConfig, viteConfig: InlineConfig, { ssrEntry, ssgOut, format }: { ssrEntry: string, ssgOut: string, format: ViteSSGOptions['format'] }): Promise<void> {
  buildLog('Build for server...')
  process.env.VITE_SSG = 'true'
  const { base } = config

  await viteBuild(mergeConfig(viteConfig, {
    base,
    build: {
      ssr: ssrEntry,
      outDir: ssgOut,
      minify: false,
      cssCodeSplit: false,
      rollupOptions: {
        output: format === 'esm'
          ? {
              entryFileNames: '[name].mjs',
              format: 'esm',
            }
          : {
              entryFileNames: '[name].cjs',
              format: 'cjs',
            },
      },
    },
    mode: config.mode,
  }))
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
    crittersOptions = {},
    includedRoutes: configIncludedRoutes = DefaultIncludedRoutes,
    onBeforePageRender,
    onPageRendered,
    onDonePageRender,
    onFinished,
    dirStyle = 'flat',
    includeAllRoutes = false,
    format = 'esm',
    concurrency = 20,
    rootContainerId = 'app',
  }: ViteSSGOptions = Object.assign({}, config.ssgOptions || {}, ssgOptions)

  const ssgOut = isAbsolute(_ssgOutDir) ? _ssgOutDir : join(root, _ssgOutDir)

  let willRunBuild: boolean = true
  if (fs.existsSync(ssgOut)) {
    willRunBuild = !ssgOptions['skip-build']
    if (willRunBuild) {
      await fs.remove(ssgOut)
    }
  }

  // client
  if (willRunBuild)
    await buildClient(config, viteConfig)

  // load jsdom before building the SSR and so jsdom will be available
  if (mock) {
    // @ts-expect-error just ignore it
    const { jsdomGlobal }: { jsdomGlobal: () => void } = await import('./jsdomGlobal.mjs')
    jsdomGlobal()
  }

  // server
  const ssrEntry = await resolveAlias(config, entry)
  if (willRunBuild)
    await buildServer(config, viteConfig, { ssrEntry, ssgOut, format })

  const prefix = (format === 'esm' && process.platform === 'win32') ? 'file://' : ''
  const ext = format === 'esm' ? '.mjs' : '.cjs'

  /**
   * `join('file://')` will be equal to `'file:\'`, which is not the correct file protocol and will fail to be parsed under bun.
   * It is changed to '+' splicing here.
   */
  const serverEntry = prefix + join(ssgOut, parse(ssrEntry).name + ext).replace(/\\/g, '/')

  const _require = createRequire(import.meta.url)

  const { createApp, includedRoutes: serverEntryIncludedRoutes }: { createApp: CreateAppFactory, includedRoutes: ViteSSGOptions['includedRoutes'] } = format === 'esm'
    ? await import(serverEntry)
    : _require(serverEntry)
  const includedRoutes = serverEntryIncludedRoutes || configIncludedRoutes
  const { routes } = await createApp(false)

  let routesPaths = includeAllRoutes
    ? routesToPaths(routes)
    : await includedRoutes(routesToPaths(routes), routes || [])

  // uniq
  routesPaths = Array.from(new Set(routesPaths))

  buildLog('Rendering Pages...', routesPaths.length)

  const critters = crittersOptions !== false
    ? await getCritters(outDir, crittersOptions)
    : undefined
  if (critters)
    console.log(`${gray('[vite-ssg]')} ${blue('Critical CSS generation enabled via `critters`')}`)

  const {
    path: _ssrManifestPath,
    content: ssrManifestRaw,
  } = await readFiles(
    join(out, '.vite', 'ssr-manifest.json'), // Vite 5
    join(out, 'ssr-manifest.json'), // Vite 4 and below
  )
  const ssrManifest: Manifest = JSON.parse(ssrManifestRaw)
  let indexHTML = await fs.readFile(join(out, 'index.html'), 'utf-8')
  indexHTML = rewriteScripts(indexHTML, script)

  const { renderToString }: typeof import('vue/server-renderer') = await import('vue/server-renderer')

  const queue = new PQueue({ concurrency })

  for (const route of routesPaths) {
    await queue.onSizeLessThan(concurrency + 5) // avoid grow the number of tasks in queue
    queue.add(async () => {
      const executeTaskFn = async () => {
        try {
          const appCtx = await createApp(false, route) as ViteSSGContext<true>
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
          const preloads = buildPreloadLinks({ html: transformedIndexHTML }, ctx.modules || new Set<string>(), ssrManifest)
          let ssrHead = {
            headTags: preloads.join('\n'),
            bodyAttrs: '',
            htmlAttrs: '',
            bodyTagsOpen: '',
            bodyTags: '',
          }
          if (head) {
            const tmpSSrHead = await renderSSRHead(head as any)
            ssrHead = Object.assign(tmpSSrHead, {
              headTags: `${tmpSSrHead.headTags.trim()}${ssrHead.headTags}`,
            })
          }

          const html = await renderHTML({
            rootContainerId,
            indexHTML: transformedIndexHTML,
            appHTML,
            initialState: transformState(initialState),
            ssrHead,
          })

          let transformed = (await onPageRendered?.(route, html, appCtx)) || html
          if (critters)
            transformed = await critters.process(transformed)

          const formatted = await formatHtml(transformed, formatting)

          const relativeRouteFile = `${(route.endsWith('/')
            ? `${route}index`
            : route).replace(/^\//g, '')}.html`

          const filename = dirStyle === 'nested'
            ? join(route.replace(/^\//g, ''), 'index.html')
            : relativeRouteFile

          await fs.ensureDir(join(out, dirname(filename)))
          await fs.writeFile(join(out, filename), formatted, 'utf-8')

          config.logger.info(
            `${dim(`${outDir}/`)}${cyan(filename.padEnd(15, ' '))}  ${dim(getSize(formatted))}`,
          )
          return { route, html, appCtx }
        }
        catch (err: any) {
          throw new Error(`${gray('[vite-ssg]')} ${red(`Error on page: ${cyan(route)}`)}\n${err.stack}`)
        }
      }
      const taskPromise = executeTaskFn()
      await taskPromise.then(({ route, html, appCtx }) => onDonePageRender?.(route, html, appCtx))
    })
  }

  await queue.start().onIdle()

  ssgOptions['skip-build'] || await fs.remove(ssgOut)

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

// @ts-ignore
async function createJSDOM(renderedHTML: string) {
  const jsdom = new JSDOM(renderedHTML, { runScripts: 'dangerously' })
  async function dispose() {
    const { window } = jsdom
    window.close()
    await new Promise(res => setImmediate(res))
  };
  return { jsdom, dispose }
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
  return result || join(config.root, entry)
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
}: {
  rootContainerId: string
  indexHTML: string
  appHTML: string
  initialState: any
  ssrHead: SSRHeadPayload
},
) {
  // const regex = new RegExp(`<\\w+(?:[-\\w])?\\s*id\\s*=\\s*("|')${rootContainerId}\\1`)
  // if (!regex.test(indexHTML)) {
  //   throw new Error(`Could not find a tag with id="${rootContainerId}" to replace it with server-side rendered HTML`)
  // }

  const stateScript = initialState ? `\n<script>window.__INITIAL_STATE__=${initialState}<\/script>\n` : ''
  const injectOptions: InjectOptions[] = [
    { match: { tag: 'html' }, attrs: ssrHead.htmlAttrs },
    { match: { tag: 'head' }, prepend: ssrHead.headTags },
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

async function formatHtml(html: string, formatting: ViteSSGOptions['formatting']) {
  if (formatting === 'minify') {
    const htmlMinifier = await import('html-minifier-terser')
    return await htmlMinifier.minify(html, {
      collapseWhitespace: true,
      caseSensitive: true,
      collapseInlineTagWhitespace: false,
      minifyJS: true,
      minifyCSS: true,
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
    if (fs.existsSync(path)) {
      return {
        path,
        content: await fs.readFile(path, 'utf-8'),
      }
    }
  }
  throw new Error(`Could not find any of the following files: ${paths.join(', ')}`)
}
