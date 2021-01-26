import { join, dirname } from 'path'
import chalk from 'chalk'
import fs from 'fs-extra'
import { build as viteBuild, resolveConfig, UserConfig } from 'vite'
import { renderToString, SSRContext } from '@vue/server-renderer'
import { JSDOM } from 'jsdom'
import { RollupOutput } from 'rollup'
import { ViteSSGContext, ViteSSGOptions } from '../client'
import { renderPreloadLinks } from './perloadlink'
import { buildLog, getSize } from './utils'

export async function build(cliOptions: ViteSSGOptions = {}) {
  const mode = process.env.MODE || process.env.NODE_ENV || 'production'
  const config = await resolveConfig({}, 'build', mode)

  const cwd = process.cwd()
  const root = config.root || cwd
  const ssgOut = join(root, '.vite-ssg-temp')
  const outDir = config.build.outDir || 'dist'
  const out = join(root, outDir)

  const {
    script = 'sync',
    mock = 'false',
    entry = 'src/main.ts',
    formatting = null,
    prefetchAssets = true,
    onBeforePageRender,
    onPageRendered,
    onFinished,
  } = Object.assign({}, config.ssgOptions || {}, cliOptions)

  if (fs.existsSync(ssgOut))
    await fs.remove(ssgOut)

  const ssrConfig: UserConfig = {
    build: {
      ssr: true,
      outDir: ssgOut,
      minify: false,
      cssCodeSplit: false,
      rollupOptions: {
        input: {
          app: join(root, entry),
        },
      },
    },
  }

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
  }) as RollupOutput

  buildLog('Build for server...')

  await viteBuild(ssrConfig)

  const ssrManifest = JSON.parse(await fs.readFile(join(out, 'ssr-manifest.json'), 'utf-8'))

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createApp } = require(join(ssgOut, 'app.js')) as { createApp(client: boolean): ViteSSGContext }

  let indexHTML = await fs.readFile(join(out, 'index.html'), 'utf-8')

  const { routes } = createApp(false)
  // ignore dynamic routes
  const routesPaths = routes
    .map(i => i.path)
    .filter(i => !i.includes(':'))

  indexHTML = rewriteScripts(indexHTML, script)

  buildLog('Rendering Pages...', routesPaths.length)

  if (mock) {
    const jsdom = new JSDOM()
    // @ts-ignore
    global.window = jsdom.window
    Object.assign(global, jsdom.window)
  }

  await Promise.all(
    routesPaths.map(async(route) => {
      const { app, router, head } = createApp(false)

      router.push(route)
      await router.isReady()

      const transformedIndexHTML = (await onBeforePageRender?.(route, indexHTML)) || indexHTML

      const ctx: SSRContext = {}
      let appHTML = await renderToString(app, ctx)

      // need to resolve assets so render content first
      const renderedHTML = renderHTML(transformedIndexHTML, appHTML)

      // create jsdom from renderedHTML
      const jsdom = new JSDOM(renderedHTML)

      // render current page's preloadLinks
      renderPreloadLinks(jsdom.window.document, ctx.modules, ssrManifest, prefetchAssets)

      // render head
      head.updateDOM(jsdom.window.document)

      const html = jsdom.serialize()
      const transformed = (await onPageRendered?.(route, html)) || html
      const formatted = format(transformed, formatting)

      const relativeRoute = (route.endsWith('/') ? `${route}index` : route).slice(1)
      const filename = `${relativeRoute}.html`

      await fs.ensureDir(join(out, dirname(relativeRoute)))
      await fs.writeFile(join(out, filename), formatted, 'utf-8')

      config.logger.info(
        `${chalk.dim(`${outDir}/`)}${chalk.cyan(filename)}\t${chalk.dim(getSize(formatted))}`,
      )
    }),
  )

  await fs.remove(ssgOut)

  console.log(`\n${chalk.gray('[vite-ssg]')} ${chalk.green('Build finished.')}`)

  onFinished?.()
}

function rewriteScripts(indexHTML: string, mode?: string) {
  if (!mode || mode === 'sync')
    return indexHTML
  return indexHTML.replace(/<script type="module" /g, `<script type="module" ${mode} `)
}

function renderHTML(indexHTML: string, appHTML: string) {
  return indexHTML
    .replace('<div id="app">', `<div id="app" data-server-rendered="true">${appHTML}`)
}

function format(html: string, formatting: ViteSSGOptions['formatting']) {
  if (formatting === 'minify') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('html-minifier').minify(html, {
      collapseWhitespace: true,
      caseSensitive: true,
      collapseInlineTagWhitespace: true,
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
