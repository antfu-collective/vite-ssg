import { join, dirname } from 'path'
import fs from 'fs-extra'
import { build as clientBuild, ssrBuild, resolveConfig, ResolvedConfig } from 'vite'
import { renderToString } from '@vue/server-renderer'
import type { ViteSSGContext } from './index'

export async function build({ script = 'sync' }) {
  const config = await resolveConfig(process.env.MODE || process.env.NODE_ENV || 'production')
  const root = config.root || process.cwd()
  const ssgOut = join(root, '.vite-ssg-dist')
  const ssrConfig: ResolvedConfig = {
    ...config,
    outDir: ssgOut,
    rollupInputOptions: {
      ...config.rollupInputOptions,
      input: {
        main: join(root, './src/main.ts'),
      },
      preserveEntrySignatures: 'allow-extension',
    },
  }

  console.log('[vite-ssg] Build for client + server...')

  await Promise.all([
    clientBuild(config),
    ssrBuild(ssrConfig),
  ])

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createApp } = require(join(ssgOut, '_assets/main.js')) as { createApp(client: boolean): ViteSSGContext }
  const out = join(root, config.outDir || 'dist')
  let indexHTML = await fs.readFile(join(out, 'index.html'), 'utf-8')

  const { routes } = createApp(false)
  // ignore dynamic routes
  const routesPathes = routes.map(i => i.path).filter(i => !i.includes(':'))

  if (script && script !== 'async')
    indexHTML = indexHTML.replace(/<script type="module" /g, `<script type="module" ${script} `)

  console.log('[vite-ssg] Rendering Pages...')
  await Promise.all(
    routesPathes.map(async(route) => {
      const { app, router } = createApp(false)
      router.push(route)
      await router.isReady()
      const content = await renderToString(app)
      const relativeRoute = (route.endsWith('/') ? `${route}index` : route).slice(1)
      const html = indexHTML.replace('<div id="app">', `<div id="app" data-server-rendered="true">${content}`)
      await fs.ensureDir(join(out, dirname(relativeRoute)))
      await fs.writeFile(join(out, `${relativeRoute}.html`), html, 'utf-8')
    }),
  )

  await fs.remove(ssgOut)

  console.log('[vite-ssg] Build finished.')
}
