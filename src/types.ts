import type { App } from 'vue'
import type { Router, RouteRecordRaw, RouterOptions as VueRouterOptions } from 'vue-router'
import type { HeadClient } from '@vueuse/head'
import type { Options as CrittersOptions } from 'critters'

export interface ViteSSGOptions {
  /**
   * Rewrite scripts loading mode, only works for `type="module"`
   *
   * @default 'sync'
   */
  script?: 'sync' | 'async' | 'defer' | 'async defer'

  /**
   * The path of main entry, relative to the project root
   *
   * @default 'src/main.ts'
   */
  entry?: string

  /**
   * Mock browser global variables (window, document, etc.) for SSG
   *
   * @default false
   */
  mock?: boolean

  /**
   * Applying formatter to the generated index file.
   *
   * @default 'none'
   */
  formatting?: 'minify' | 'prettify' | 'none'

  /**
   * Vite environment mode
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
   * Options for critters
   *
   * @see https://github.com/GoogleChromeLabs/critters
   */
  crittersOptions?: CrittersOptions | false

  /**
   * Custom functions to modified the routes to do the SSG.
   *
   * Works only when `includeAllRoutes` is set to false.
   *
   * Default to a handler that filter out all the dynamic routes,
   * when passing your custom handler, you should also take care the dynamic routes yourself.
   */
  includedRoutes?: (routes: string[]) => Promise<string[]> | string[]

  /**
   * Callback to be called before every page render.
   *
   * Also give the change to transform the index html passed to the renderer.
   */
  onBeforePageRender?: (route: string, indexHTML: string, appCtx: ViteSSGContext<true>) => Promise<string | null | undefined> | string | null | undefined

  /**
   * Callback to be called on every page rendered.
   *
   * Also give the change to transform the rendered html by returning a string.
   */
  onPageRendered?: (route: string, renderedHTML: string, appCtx: ViteSSGContext<true>) => Promise<string | null | undefined> | string | null | undefined

  onFinished?: () => Promise<void> | void
}

type PartialKeys<T, Keys extends keyof T> = Omit<T, Keys> & Partial<Pick<T, Keys>>

export interface ViteSSGContext<HasRouter extends boolean = true> {
  app: App<Element>
  router: HasRouter extends true ? Router : undefined
  routes: HasRouter extends true ? RouteRecordRaw[] : undefined
  initialState: Record<string, any>
  head: HeadClient | undefined
  isClient: boolean
  /**
   * Current router path on SSG, `undefined` on client side.
   */
  routePath?: string
}

export interface ViteSSGClientOptions {
  transformState?: (state: any) => any
  registerComponents?: boolean
  useHead?: boolean
  rootContainer?: string | Element
}

export type RouterOptions = PartialKeys<VueRouterOptions, 'history'> & { base?: string }

// extend vite.config.ts
declare module 'vite' {
  interface UserConfig {
    ssgOptions?: ViteSSGOptions
  }
}
