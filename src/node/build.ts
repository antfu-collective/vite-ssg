/* eslint-disable no-console */
import { join, dirname, isAbsolute } from 'path'
import chalk from 'chalk'
import fs from 'fs-extra'
import { build as viteBuild, resolveConfig, UserConfig, ResolvedConfig } from 'vite'
import { renderToString, SSRContext } from '@vue/server-renderer'
import { JSDOM, VirtualConsole } from 'jsdom'
import { RollupOutput } from 'rollup'
import type { VitePluginPWAAPI } from 'vite-plugin-pwa'
import { ViteSSGContext, ViteSSGOptions } from '../client'
import { renderPreloadLinks } from './preload-links'
import { buildLog, routesToPaths, getSize } from './utils'
import { getCritters } from './critical'

export interface Manifest {
  [key: string]: string[]
}

export type CreateAppFactory = (client: boolean, routePath?: string) => Promise<ViteSSGContext<true> | ViteSSGContext<false>>

function DefaultIncludedRoutes(paths: string[]) {
  // ignore dynamic routes
  return paths.filter(i => !i.includes(':') && !i.includes('*'))
}

export async function build(cliOptions: Partial<ViteSSGOptions> = {}) {
  const mode = process.env.MODE || process.env.NODE_ENV || cliOptions.mode || 'production'
  const config = await resolveConfig({}, 'build', mode)

  const cwd = process.cwd()
  const root = config.root || cwd
  const ssgOut = join(root, '.vite-ssg-temp')
  const outDir = config.build.outDir || 'dist'
  const out = isAbsolute(outDir) ? outDir : join(root, outDir)

  const {
    script = 'sync',
    mock = false,
    entry = await detectEntry(root),
    formatting = 'none',
    crittersOptions = {},
    includedRoutes = DefaultIncludedRoutes,
    onBeforePageRender,
    onPageRendered,
    onFinished,
  }: ViteSSGOptions = Object.assign({}, config.ssgOptions || {}, cliOptions)

  if (fs.existsSync(ssgOut))
    await fs.remove(ssgOut)

  // client
  buildLog('Build for client...')
  await viteBuild({
    build: {
      ssrManifest: true,
      rollupOptions: {
        input: {
          app: join(root, './index.html'),
        },
      },
    },
    mode: config.mode,
  }) as RollupOutput

  // server
  buildLog('Build for server...')
  process.env.VITE_SSG = 'true'
  await viteBuild({
    build: {
      ssr: await resolveAlias(config, entry),
      outDir: ssgOut,
      minify: false,
      cssCodeSplit: false,
    },
    mode: config.mode,
  })

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createApp } = require(join(ssgOut, 'main.js')) as { createApp: CreateAppFactory }

  const { routes, initialState } = await createApp(false)

  let routesPaths = await includedRoutes(routesToPaths(routes))
  // uniq
  routesPaths = Array.from(new Set(routesPaths))

  buildLog('Rendering Pages...', routesPaths.length)

  const critters = crittersOptions !== false ? getCritters(outDir, crittersOptions) : undefined
  if (critters)
    console.log(`${chalk.gray('[vite-ssg]')} ${chalk.blue('Critical CSS generation enabled via `critters`')}`)

  if (mock) {
    const virtualConsole = new VirtualConsole()
    const jsdom = new JSDOM('', { url: 'http://localhost', virtualConsole })
    // @ts-ignore
    global.window = jsdom.window
    Object.assign(global, jsdom.window)
  }

  const ssrManifest: Manifest = JSON.parse(await fs.readFile(join(out, 'ssr-manifest.json'), 'utf-8'))
  let indexHTML = await fs.readFile(join(out, 'index.html'), 'utf-8')
  indexHTML = rewriteScripts(indexHTML, script)

  await Promise.all(
    routesPaths.map(async(route) => {
      const { app, router, head } = await createApp(false, route)

      if (router) {
        await router.push(route)
        await router.isReady()
      }

      const transformedIndexHTML = (await onBeforePageRender?.(route, indexHTML)) || indexHTML

      const ctx: SSRContext = {}
      const appHTML = await renderToString(app, ctx)

      // need to resolve assets so render content first
      const renderedHTML = renderHTML({ indexHTML: transformedIndexHTML, appHTML, initialState })

      // create jsdom from renderedHTML
      const jsdom = new JSDOM(renderedHTML)

      // render current page's preloadLinks
      renderPreloadLinks(jsdom.window.document, ctx.modules || new Set<string>(), ssrManifest)

      // render head
      head?.updateDOM(jsdom.window.document)

      const html = jsdom.serialize()
      let transformed = (await onPageRendered?.(route, html)) || html
      if (critters)
        transformed = await critters.process(transformed)

      const formatted = format(transformed, formatting)

      const relativeRoute = (route.endsWith('/') ? `${route}index` : route).replace(/^\//g, '')
      const filename = `${relativeRoute}.html`

      await fs.ensureDir(join(out, dirname(relativeRoute)))
      await fs.writeFile(join(out, filename), formatted, 'utf-8')

      config.logger.info(
        `${chalk.dim(`${outDir}/`)}${chalk.cyan(filename)}\t${chalk.dim(getSize(formatted))}`,
      )
    }),
  )

  await fs.remove(ssgOut)

  // when `vite-plugin-pwa` is presented, use it to regenerate SW after rendering
  const pwaPlugin: VitePluginPWAAPI = config.plugins.find(i => i.name === 'vite-plugin-pwa')?.api
  if (pwaPlugin?.generateSW) {
    buildLog('Regenerate PWA...')
    await pwaPlugin.generateSW()
  }

  console.log(`\n${chalk.gray('[vite-ssg]')} ${chalk.green('Build finished.')}`)

  onFinished?.()
}

function rewriteScripts(indexHTML: string, mode?: string) {
  if (!mode || mode === 'sync')
    return indexHTML
  return indexHTML.replace(/<script type="module" /g, `<script type="module" ${mode} `)
}

function renderHTML({ indexHTML, appHTML, initialState }: { indexHTML: string; appHTML: string; initialState: any }) {
  const stateScript = initialState
    ? `\n<script>window.__INITIAL_STATE__=${initialState}</script>`
    : ''
  return indexHTML
    .replace(
      '<div id="app"></div>',
      `<div id="app" data-server-rendered="true">${appHTML}</div>${stateScript}`,
    )
}

function format(html: string, formatting: ViteSSGOptions['formatting']) {
  if (formatting === 'minify') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('html-minifier').minify(html, {
      collapseWhitespace: true,
      caseSensitive: true,
      collapseInlineTagWhitespace: false,
      minifyJS: true,
      minifyCSS: true,
    })
  }
  else if (formatting === 'prettify') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('prettier').format(html, { semi: false, parser: 'html' })
  }
  return html
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
