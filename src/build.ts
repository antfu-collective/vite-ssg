import path, { join } from 'path'
import fs from 'fs-extra'
import { build as clientBuild, ssrBuild, resolveConfig, ResolvedConfig } from 'vite'
import { renderToString } from '@vue/server-renderer'
import type { ViteSSGContext } from './index'

export async function build() {
  const cwd = process.cwd()
  const config = await resolveConfig('production')
  const ssrConfig: ResolvedConfig = {
    ...config,
    rollupInputOptions: {
      ...config.rollupInputOptions,
      input: {
        main: join(cwd, './src/main.ts'),
      },
      preserveEntrySignatures: 'allow-extension',
    },
  }

  // const voie =
  //   config.rollupInputOptions?.plugins?.find((i) => i.name === 'voie') ||
  //   config.rollupInputOptions?.pluginsPreBuild?.find((i) => i.name === 'voie') ||
  //   config.rollupInputOptions?.pluginsPostBuild?.find((i) => i.name === 'voie')

  // if (!voie) throw new Error('Voie plugin not found')

  // // @ts-ignore
  // const routesStr: string = await voie.load('voie-pages')
  // // eslint-disable-next-line no-eval
  // const routes: RouteRecordRaw[] = eval(
  //   routesStr
  //     .replace('export default ', '')
  //     .replace(/import.*from '.*?'/g, '')
  //     .replace(/component: .*?}/g, '}'),
  // )
  // const routesPathes = routes.map(i => i.path).filter(i => !i.includes(':'))

  await Promise.all([
    clientBuild(config),
    ssrBuild(ssrConfig),
  ])

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createApp } = require(join(cwd, 'dist-ssr/_assets/main.js')) as { createApp(client: boolean): ViteSSGContext }
  const out = join(cwd, 'dist')
  const indexHTML = await fs.readFile(path.join(out, 'index.html'), 'utf-8')

  const { routes } = createApp(false)
  const routesPathes = routes.map(i => i.path).filter(i => !i.includes(':'))

  await Promise.all(
    routesPathes.map(async(route) => {
      const { app, router } = createApp(false)
      router.push(route)
      await router.isReady()
      const content = await renderToString(app)
      const relativeRoute = (route.endsWith('/') ? `${route}index` : route).slice(1)
      const html = indexHTML.replace('<div id="app">', `<div id="app" data-server-rendered="true">${content}`)
      await fs.ensureDir(path.join(out, path.dirname(relativeRoute)))
      await fs.writeFile(path.join(out, `${relativeRoute}.html`), html, 'utf-8')
    }),
  )
}
