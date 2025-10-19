/* eslint-disable no-console */
import type { InlineConfig, ResolvedConfig } from 'vite'
import type { VitePluginPWAAPI } from 'vite-plugin-pwa'
import type { RouteRecordRaw } from 'vue-router'
import type { SSRContext } from 'vue/server-renderer'
import type { ViteSSGContext, ViteSSGOptions } from '../types'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { dirname, isAbsolute, join, parse, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { renderDOMHead } from '@unhead/dom'
import { blue, cyan, dim, gray, green, red } from 'ansis'
import { JSDOM } from 'jsdom'
import PQueue from 'p-queue'
import { mergeConfig, resolveConfig, build as viteBuild } from 'vite'
import { serializeState } from '../utils/state'
import { getBeasties } from './critical'
import { renderPreloadLinks } from './preload-links'
import { buildLog, getSize, prepareHtmlFileName, routesToPaths } from './utils'

export type Manifest = Record<string, string[]>

export type CreateAppFactory = (routePath?: string) => Promise<ViteSSGContext<true> | ViteSSGContext<false>>

function DefaultIncludedRoutes(paths: string[], _routes: Readonly<RouteRecordRaw[]>) {
  // ignore dynamic routes
  return paths.filter(i => !i.includes(':') && !i.includes('*'))
}

export async function build(ssgOptions: Partial<ViteSSGOptions> = {}, viteConfig: InlineConfig = {}) {
  const nodeEnv = process.env.NODE_ENV || 'production'
  const mode = process.env.MODE || ssgOptions.mode || nodeEnv
  const config = await resolveConfig(viteConfig, 'build', mode, nodeEnv)

  const cwd = process.cwd()
  const root = config.root || cwd
  const ssgOutTempFolder = resolve(root, '.vite-ssg-temp')
  const ssgOut = resolve(ssgOutTempFolder, Math.random().toString(36).substring(2, 12))
  const outDir = config.build.outDir || 'dist'
  const out = isAbsolute(outDir) ? outDir : resolve(root, outDir)

  const mergedOptions = Object.assign({}, config.ssgOptions || {}, ssgOptions)
  const {
    script = 'sync',
    mock = false,
    entry = await detectEntry(root),
    formatting = 'none',
    includedRoutes: configIncludedRoutes = DefaultIncludedRoutes,
    onBeforePageRender,
    onPageRendered,
    onFinished,
    dirStyle = 'flat',
    includeAllRoutes = false,
    concurrency = 20,
    rootContainerId = 'app',
    base,
    htmlFileName,
  }: ViteSSGOptions = mergedOptions

  const beastiesOptions = mergedOptions.beastiesOptions ?? {}

  if (existsSync(ssgOutTempFolder))
    await fs.rm(ssgOutTempFolder, { recursive: true })

  // client
  buildLog('Build for client...')
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

  // load jsdom before building the SSR and so jsdom will be available
  if (mock) {
    // @ts-expect-error just ignore it
    const { jsdomGlobal }: { jsdomGlobal: () => void } = await import('./jsdomGlobal.mjs')
    jsdomGlobal()
  }

  // server
  buildLog('Build for server...')
  process.env.VITE_SSG = 'true'
  const ssrEntry = await resolveAlias(config, entry)
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

  const serverEntry = pathToFileURL(resolve(ssgOut, `${parse(ssrEntry).name}.mjs`)).href
  const {
    createApp,
    includedRoutes: serverEntryIncludedRoutes,
  }: {
    createApp: CreateAppFactory
    includedRoutes: ViteSSGOptions['includedRoutes']
  } = await import(serverEntry)

  const includedRoutes = serverEntryIncludedRoutes || configIncludedRoutes
  const { routes } = await createApp()

  let routesPaths = includeAllRoutes
    ? routesToPaths(routes)
    : await includedRoutes(routesToPaths(routes), routes || [])

  // uniq
  routesPaths = Array.from(new Set(routesPaths))

  buildLog('Rendering Pages...', routesPaths.length)

  const beasties = beastiesOptions !== false
    ? await getBeasties(outDir, beastiesOptions)
    : undefined

  if (beasties)
    console.log(`${gray('[vite-ssg]')} ${blue('Critical CSS generation enabled via `beasties`')}`)

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

  const { renderToString }: typeof import('vue/server-renderer') = await import('vue/server-renderer')

  const queue = new PQueue({ concurrency })

  for (const route of routesPaths) {
    queue.add(async () => {
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
        const renderedHTML = await renderHTML({
          rootContainerId,
          indexHTML: transformedIndexHTML,
          appHTML,
          initialState: transformState(initialState),
        })

        // create jsdom from renderedHTML
        const jsdom = new JSDOM(renderedHTML)

        // render current page's preloadLinks
        renderPreloadLinks(jsdom.window.document, ctx.modules || new Set<string>(), ssrManifest)

        // render head
        if (head)
          await renderDOMHead(head, { document: jsdom.window.document })

        const html = jsdom.serialize()
        let transformed = (await onPageRendered?.(route, html, appCtx)) || html
        if (beasties)
          transformed = await beasties.process(transformed)

        const formatted = await formatHtml(transformed, formatting)

        const relativeRouteFile = `${(route.endsWith('/')
          ? `${route}index`
          : route).replace(/^\//g, '')}.html`

        const filename = await prepareHtmlFileName(
          dirStyle === 'nested'
            ? join(route.replace(/^\//g, ''), 'index.html')
            : relativeRouteFile,
          htmlFileName,
        )

        await fs.mkdir(resolve(out, dirname(filename)), { recursive: true })
        await fs.writeFile(resolve(out, filename), formatted, 'utf-8')
        config.logger.info(
          `${dim(`${outDir}/`)}${cyan(filename.padEnd(15, ' '))}  ${dim(getSize(formatted))}`,
        )
      }
      catch (err: any) {
        throw new Error(`${gray('[vite-ssg]')} ${red(`Error on page: ${cyan(route)}`)}\n${err.stack}`)
      }
    })
  }

  await queue.start().onIdle()

  await fs.rm(ssgOutTempFolder, { recursive: true, force: true })

  // when `vite-plugin-pwa` is presented, use it to regenerate SW after rendering
  const pwaPlugin: VitePluginPWAAPI = config.plugins.find(i => i.name === 'vite-plugin-pwa')?.api
  if (pwaPlugin && !pwaPlugin.disabled && pwaPlugin.generateSW) {
    buildLog('Regenerate PWA...')
    await pwaPlugin.generateSW()
  }

  console.log(`\n${gray('[vite-ssg]')} ${green('Build finished.')}`)

  await onFinished?.()
}

async function detectEntry(root: string) {
  // pick the first script tag of type module as the entry
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const scriptSrcReg = /<script.*?src=["'](.+?)["'](?!<).*>\s*<\/script>/gi
  const html = await fs.readFile(resolve(root, 'index.html'), 'utf-8')
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
}: {
  rootContainerId: string
  indexHTML: string
  appHTML: string
  initialState: any
}) {
  const stateScript = initialState
    ? `\n<script>window.__INITIAL_STATE__=${initialState}</script>`
    : ''
  const container = `<div id="${rootContainerId}"></div>`
  if (indexHTML.includes(container)) {
    return indexHTML
      .replace(
        container,
        () => `<div id="${rootContainerId}" data-server-rendered="true">${appHTML}</div>${stateScript}`,
      )
  }

  const html5Parser = await import('html5parser')
  const ast = html5Parser.parse(indexHTML)
  let renderedOutput: string | undefined

  html5Parser.walk(ast, {
    enter: (node) => {
      if (!renderedOutput
        && node?.type === html5Parser.SyntaxKind.Tag
        && Array.isArray(node.attributes)
        && node.attributes.length > 0
        && node.attributes.some(attr => attr.name.value === 'id' && attr.value?.value === rootContainerId)
      ) {
        const attributesStringified = [...node.attributes.map(({ name: { value: name }, value }) => `${name}="${value!.value}"`)].join(' ')
        const indexHTMLBefore = indexHTML.slice(0, node.start)
        const indexHTMLAfter = indexHTML.slice(node.end)
        renderedOutput = `${indexHTMLBefore}<${node.name} ${attributesStringified} data-server-rendered="true">${appHTML}</${node.name}>${stateScript}${indexHTMLAfter}`
      }
    },
  })

  if (!renderedOutput)
    throw new Error(`Could not find a tag with id="${rootContainerId}" to replace it with server-side rendered HTML`)

  return renderedOutput
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
    if (existsSync(path)) {
      return {
        path,
        content: await fs.readFile(path, 'utf-8'),
      }
    }
  }
  throw new Error(`Could not find any of the following files: ${paths.join(', ')}`)
}
