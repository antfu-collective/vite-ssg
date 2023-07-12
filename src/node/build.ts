/* eslint-disable no-console */
import { dirname, isAbsolute, join, parse } from 'node:path'
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
import { renderDOMHead } from '@unhead/dom'
import type { ViteSSGContext, ViteSSGOptions } from '../types'
import { serializeState } from '../utils/state'
import { renderPreloadLinks } from './preload-links'
import { buildLog, getSize, routesToPaths } from './utils'
import { getCritters } from './critical'

export type Manifest = Record<string, string[]>

export type CreateAppFactory = (client: boolean, routePath?: string) => Promise<ViteSSGContext<true> | ViteSSGContext<false>>

function DefaultIncludedRoutes(paths: string[], _routes: Readonly<RouteRecordRaw[]>) {
  // ignore dynamic routes
  return paths.filter(i => !i.includes(':') && !i.includes('*'))
}

export async function build(ssgOptions: Partial<ViteSSGOptions> = {}, viteConfig: InlineConfig = {}) {
  const mode = process.env.MODE || process.env.NODE_ENV || ssgOptions.mode || 'production'
  const config = await resolveConfig(viteConfig, 'build', mode, mode !== 'development' ? 'production' : 'development')

  const cwd = process.cwd()
  const root = config.root || cwd
  const ssgOut = join(root, '.vite-ssg-temp', Math.random().toString(36).substring(2, 12))
  const outDir = config.build.outDir || 'dist'
  const out = isAbsolute(outDir) ? outDir : join(root, outDir)

  const {
    script = 'sync',
    mock = false,
    entry = await detectEntry(root),
    formatting = 'none',
    crittersOptions = {},
    includedRoutes: configIncludedRoutes = DefaultIncludedRoutes,
    onBeforePageRender,
    onPageRendered,
    onFinished,
    dirStyle = 'flat',
    includeAllRoutes = false,
    format = 'esm',
    concurrency = 20,
    rootContainerId = 'app',
  }: ViteSSGOptions = Object.assign({}, config.ssgOptions || {}, ssgOptions)

  if (fs.existsSync(ssgOut))
    await fs.remove(ssgOut)

  // client
  buildLog('Build for client...')
  await viteBuild(mergeConfig(viteConfig, {
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

  const prefix = (format === 'esm' && process.platform === 'win32') ? 'file://' : ''
  const ext = format === 'esm' ? '.mjs' : '.cjs'
  const serverEntry = join(prefix, ssgOut, parse(ssrEntry).name + ext)

  const _require = createRequire(import.meta.url)

  const { createApp, includedRoutes: serverEntryIncludedRoutes }: { createApp: CreateAppFactory; includedRoutes: ViteSSGOptions['includedRoutes'] } = format === 'esm'
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

  const critters = crittersOptions !== false ? await getCritters(outDir, crittersOptions) : undefined
  if (critters)
    console.log(`${gray('[vite-ssg]')} ${blue('Critical CSS generation enabled via `critters`')}`)

  const ssrManifest: Manifest = JSON.parse(await fs.readFile(join(out, 'ssr-manifest.json'), 'utf-8'))
  let indexHTML = await fs.readFile(join(out, 'index.html'), 'utf-8')
  indexHTML = rewriteScripts(indexHTML, script)

  const { renderToString }: typeof import('vue/server-renderer') = await import('vue/server-renderer')

  const queue = new PQueue({ concurrency })

  for (const route of routesPaths) {
    queue.add(async () => {
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
      }
      catch (err: any) {
        throw new Error(`${gray('[vite-ssg]')} ${red(`Error on page: ${cyan(route)}`)}\n${err.stack}`)
      }
    })
  }

  await queue.start().onIdle()

  await fs.remove(ssgOut)

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

async function detectEntry(root: string) {
  // pick the first script tag of type module as the entry
  const scriptSrcReg = /<script(?:.*?)src=["'](.+?)["'](?!<)(?:.*)\>(?:[\n\r\s]*?)(?:<\/script>)/img
  const html = await fs.readFile(join(root, 'index.html'), 'utf-8')
  const scripts = [...html.matchAll(scriptSrcReg)] || []
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
}: {
  rootContainerId: string
  indexHTML: string
  appHTML: string
  initialState: any
},
) {
  const stateScript = initialState
    ? `\n<script>window.__INITIAL_STATE__=${initialState}</script>`
    : ''
  const container = `<div id="${rootContainerId}"></div>`
  if (indexHTML.includes(container)) {
    return indexHTML
      .replace(
        container,
        `<div id="${rootContainerId}" data-server-rendered="true">${appHTML}</div>${stateScript}`,
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
    const htmlMinifier = await import('html-minifier')
    return htmlMinifier.minify(html, {
      collapseWhitespace: true,
      caseSensitive: true,
      collapseInlineTagWhitespace: false,
      minifyJS: true,
      minifyCSS: true,
    })
  }
  else if (formatting === 'prettify') {
    // @ts-expect-error dynamic import
    const prettier = (await import('prettier/esm/standalone.mjs')).default
    // @ts-expect-error dynamic import
    const parserHTML = (await import('prettier/esm/parser-html.mjs')).default

    return prettier.format(html, { semi: false, parser: 'html', plugins: [parserHTML] })
  }
  return html
}
