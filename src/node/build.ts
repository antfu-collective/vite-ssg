import { join, dirname } from 'path'
import chalk from 'chalk'
import fs from 'fs-extra'
import { build as viteBuild, resolveConfig, UserConfig } from 'vite'
import { renderToString } from '@vue/server-renderer'
import { renderHeadToString } from '@vueuse/head'
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
  const ssgOut = join(root, '.vite-ssg-dist')

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

  console.log('[vite-ssg] Build for client...')

  await viteBuild()

  console.log('[vite-ssg] Build for server...')

  process.env.VITE_SSR = 'true'
  process.env.VITE_SSG = 'true'
  await viteBuild(ssrConfig)

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createApp } = require(join(ssgOut, 'main.js')) as { createApp(client: boolean): ViteSSGContext }
  const out = join(root, config.build.outDir || 'dist')
  let indexHTML = await fs.readFile(join(out, 'index.html'), 'utf-8')

  const { routes } = createApp(false)
  // ignore dynamic routes
  const routesPaths = routes.map(i => i.path).filter(i => !i.includes(':'))

  if (script && script !== 'sync')
    indexHTML = indexHTML.replace(/<script type="module" /g, `<script type="module" ${script} `)

  if (mock) {
    const jsdom = new JSDOM()
    // @ts-ignore
    global.window = jsdom.window
    Object.assign(global, jsdom.window)
  }

  console.log('[vite-ssg] Rendering Pages...')
  await Promise.all(
    routesPaths.map(async(route) => {
      const { app, router, head } = createApp(false)
      router.push(route)
      await router.isReady()
      // @ts-ignore
      const content = await renderToString(app)
      const headCtx = await renderHeadToString(head)

      const html = renderHTML(indexHTML, { appContent: content, ...headCtx })

      const relativeRoute = (route.endsWith('/') ? `${route}index` : route).slice(1)
      const filename = `${relativeRoute}.html`
      await fs.ensureDir(join(out, dirname(relativeRoute)))
      await fs.writeFile(join(out, filename), html, 'utf-8')

      config.logger.info(
        `${chalk.gray('[write]')} ${chalk.blue(filename)} ${(html.length / 1024).toFixed(2)}kb`,
      )
    }),
  )

  await fs.remove(ssgOut)

  console.log('[vite-ssg] Build finished.')
}

function renderHTML(indexHTML: string, { appContent, headTags, htmlAttrs, bodyAttrs }: { appContent: string; headTags: string; htmlAttrs: string; bodyAttrs: string}) {
  // TODO: merge existing tags
  return indexHTML
    .replace('<html', `<html ${htmlAttrs}`)
    .replace('<body', `<body ${bodyAttrs}`)
    .replace('</head>', `${headTags}</head>`)
    .replace('<div id="app">', `<div id="app" data-server-rendered="true">${appContent}`)
}
