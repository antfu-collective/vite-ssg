import type { App } from 'vue'
import type { RouteRecordRaw, Router, RouterOptions as VueRouterOptions } from 'vue-router'
import type { HeadClient } from '@vueuse/head'
import type { Options as CrittersOptions } from 'critters'

export interface ViteSSGOptions {
  /**
   * Rewrite scripts loading mode. Only works for `type="module"`.
   *
   * @default 'sync'
   */
  script?: 'sync' | 'async' | 'defer' | 'async defer'

  /**
   * Build format.
   *
   * @default 'esm'
   */
  format?: 'esm' | 'cjs'

  /**
   * The path of the main entry file (relative to the project root).
   *
   * @default 'src/main.ts'
   */
  entry?: string

  /**
   * Mock browser global variables (window, document, etc...) for SSG.
   *
   * @default false
   */
  mock?: boolean

  /**
   * Apply formatter to the generated index file.
   *
   * @default 'none'
   */
  formatting?: 'minify' | 'prettify' | 'none'

  /**
   * Vite environment mode.
   */
  mode?: string

  /**
   * Directory style of the output directory.
   *
   * flat: `/foo` -> `/foo.html`
   * nested: `/foo` -> `/foo/index.html`
   *
   * @default flat
   */
  dirStyle?: 'flat' | 'nested'

  /**
    * Generate for all routes, including dynamic routes.
    * If enabled, you will need to configure your server
    * manually to handle dynamic routes properly.
    *
    * @default false
    */
  includeAllRoutes?: boolean

  /**
   * Options for critters.
   *
   * @see https://github.com/GoogleChromeLabs/critters
   */
  crittersOptions?: CrittersOptions | false

  /**
   * Custom function to modify the routes to do the SSG.
   *
   * Works only when `includeAllRoutes` is set to false.
   *
   * Defaults to a handler that filters out all the dynamic routes.
   * When passing your custom handler, you should also take care of the dynamic routes yourself.
   */
  includedRoutes?: (paths: string[], routes: Readonly<RouteRecordRaw[]>) => Promise<string[]> | string[]

  /**
   * Callback to be called before every page render.
   *
   * Also give the change to transform the index html passed to the renderer.
   */
  onBeforePageRender?: (route: string, indexHTML: string, appCtx: ViteSSGContext<true>) => Promise<string | null | undefined> | string | null | undefined

  /**
   * Callback to be called on every rendered page.
   *
   * Also give the change to transform the rendered html by returning a string.
   */
  onPageRendered?: (route: string, renderedHTML: string, appCtx: ViteSSGContext<true>) => Promise<string | null | undefined> | string | null | undefined

  onFinished?: () => Promise<void> | void

  /**
   * The app root container `id`.
   *
   * @default `app`
   */
  rootContainerId?: string

  /**
   * Size of generation processing queue.
   *
   * @default 20
   */
  concurrency?: number
}

type PartialKeys<T, Keys extends keyof T> = Omit<T, Keys> & Partial<Pick<T, Keys>>

export interface ViteSSGContext<HasRouter extends boolean = true> {
  app: App<Element>
  router: HasRouter extends true ? Router : undefined
  routes: HasRouter extends true ? Readonly<RouteRecordRaw[]> : undefined
  initialState: Record<string, any>
  head: HeadClient | undefined
  isClient: boolean
  onSSRAppRendered(cb: Function): void
  triggerOnSSRAppRendered(route: string, appHTML: string, appCtx: ViteSSGContext): Promise<unknown[]>
  transformState?(state: any): any
  /**
   * Current router path on SSG, `undefined` on client side.
   */
  routePath?: string
}

export interface ViteSSGClientOptions {
  transformState?: (state: any) => any
  registerComponents?: boolean
  useHead?: boolean
  /**
   * The app root container query selector.
   *
   * @default `#app`
   */
  rootContainer?: string | Element
}

export type RouterOptions = PartialKeys<VueRouterOptions, 'history'> & { base?: string }

// extend vite.config.ts
declare module 'vite' {
  interface UserConfig {
    ssgOptions?: ViteSSGOptions
  }
}
