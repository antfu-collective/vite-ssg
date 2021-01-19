import { join, dirname } from 'path'
import chalk from 'chalk'
import fs from 'fs-extra'
import { build as viteBuild, resolveConfig, UserConfig } from 'vite'
import { renderToString } from '@vue/server-renderer'
import { JSDOM } from 'jsdom'
import { ExternalOption } from 'rollup'
import type { ViteSSGContext } from '../client'

function resolveExternal(
  userExternal: ExternalOption | undefined,
): ExternalOption {
  const required = ['vue', /^@vue\//]
  if (!userExternal)
    return required

  if (Array.isArray(userExternal)) {
    return [...required, ...userExternal]
  }
  else if (typeof userExternal === 'function') {
    return (src, importer, isResolved) => {
      if (src === 'vue' || /^@vue\//.test(src))
        return true

      return userExternal(src, importer, isResolved)
    }
  }
  else {
    return [...required, userExternal]
  }
}

export async function build({ script = 'sync', mock = false } = {}) {
  const mode = process.env.MODE || process.env.NODE_ENV || 'production'
  const config = await resolveConfig({}, 'build', mode)

  const cwd = process.cwd()
  const root = config.root || cwd
  const ssgOut = join(root, '.vite-ssg-temp')
  if (fs.existsSync(ssgOut))
    await fs.remove(ssgOut)

  const ssrConfig: UserConfig = {
    build: {
      ssr: true,
      outDir: ssgOut,
      minify: false,
      cssCodeSplit: false,
      rollupOptions: {
        external: resolveExternal(config.build?.rollupOptions?.external),
        input: {
          main: join(root, './src/main.ts'),
        },
        preserveEntrySignatures: 'allow-extension',
        output: [{
          format: 'cjs',
          exports: 'named',
          entryFileNames: '[name].js',
        }],
      },
    },
  }

  console.log(`${chalk.gray('[vite-ssg]')} ${chalk.yellow('Build for client...')}`)

  await viteBuild()

  console.log(`\n${chalk.gray('[vite-ssg]')} ${chalk.yellow('Build for server...')}`)

  process.env.VITE_SSR = 'true'
  process.env.VITE_SSG = 'true'
  await viteBuild(ssrConfig)

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createApp } = require(join(ssgOut, 'main.js')) as { createApp(client: boolean): ViteSSGContext }
  const outDir = config.build.outDir || 'dist'
  const out = join(root, outDir)
  let indexHTML = await fs.readFile(join(out, 'index.html'), 'utf-8')

  const { routes } = createApp(false)
  // ignore dynamic routes
  const routesPaths = routes.map(i => i.path).filter(i => !i.includes(':'))

  indexHTML = rewriteScripts(indexHTML, script)

  if (mock) {
    const jsdom = new JSDOM()
    // @ts-ignore
    global.window = jsdom.window
    Object.assign(global, jsdom.window)
  }

  console.log(`\n${chalk.gray('[vite-ssg]')} ${chalk.yellow('Rendering Pages...')}`)

  await Promise.all(
    routesPaths.map(async(route) => {
      const { app, router, head } = createApp(false)

      router.push(route)
      await router.isReady()

      const appHTML = await renderToString(app)

      const jsdom = new JSDOM(indexHTML)
      head.updateDOM(jsdom.window.document)

      const html = renderHTML(jsdom.serialize(), appHTML)

      const relativeRoute = (route.endsWith('/') ? `${route}index` : route).slice(1)
      const filename = `${relativeRoute}.html`
      await fs.ensureDir(join(out, dirname(relativeRoute)))
      await fs.writeFile(join(out, filename), html, 'utf-8')

      config.logger.info(
        `${chalk.dim(`${outDir}/`)}${chalk.cyan(filename)}\t${chalk.dim(getSize(html))}`,
      )
    }),
  )

  await fs.remove(ssgOut)

  console.log(`\n${chalk.gray('[vite-ssg]')} ${chalk.green('Build finished.')}`)
}

function getSize(str: string) {
  return `${(str.length / 1024).toFixed(2)}kb`
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
