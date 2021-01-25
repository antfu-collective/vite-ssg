import { join, dirname } from 'path'
import chalk from 'chalk'
import fs from 'fs-extra'
import { build as viteBuild, resolveConfig, UserConfig } from 'vite'
import { renderToString, SSRContext } from '@vue/server-renderer'
import { JSDOM } from 'jsdom'
import { RollupOutput } from 'rollup'
import { ViteSSGContext, ViteSSGOptions } from '../client'
import { DEFAULT_ASSETS_RE } from './constants'
import { renderPreloadLinks } from './perloadlink'

type ViteManifest = Record<string, {
  file: string
  imports?: string[]
}>

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

  console.log(`${chalk.gray('[vite-ssg]')} ${chalk.yellow('Build for client...')}`)

  const clientResult = await viteBuild({
    build: {
      ssrManifest: true,
      manifest: true,
      rollupOptions: {
        input: {
          app: join(root, './index.html'),
        },
      },
    },
  }) as RollupOutput

  console.log(`\n${chalk.gray('[vite-ssg]')} ${chalk.yellow('Build for server...')}`)

  await viteBuild(ssrConfig)

  const manifest: ViteManifest = JSON.parse(await fs.readFile(join(out, 'manifest.json'), 'utf-8'))
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

  console.log(`\n${chalk.gray('[vite-ssg]')} ${chalk.yellow('Rendering Pages...')} ${chalk.blue(`(${routesPaths.length})`)}`)

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

      appHTML = rewriteAssets(appHTML, manifest)

      // render head
      const jsdom = new JSDOM(transformedIndexHTML)
      head.updateDOM(jsdom.window.document)

      // render current page's preloadLinks
      renderPreloadLinks(jsdom.window.document, ctx.modules, ssrManifest, clientResult, config.base)

      const html = renderHTML(jsdom.serialize(), appHTML)
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

function getSize(str: string) {
  return `${(str.length / 1024).toFixed(2)}kb`
}

function rewriteScripts(indexHTML: string, mode?: string) {
  if (!mode || mode === 'sync')
    return indexHTML
  return indexHTML.replace(/<script type="module" /g, `<script type="module" ${mode} `)
}

function rewriteAssets(appHTML: string, manifest: ViteManifest) {
  Object.keys(manifest)
    .forEach((key) => {
      if (DEFAULT_ASSETS_RE.test(key))
        appHTML = appHTML.replace(key, manifest[key].file)
    })
  return appHTML
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
