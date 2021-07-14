import { App } from 'vue'
import { Router, RouteRecordRaw, RouterOptions as VueRouterOptions } from 'vue-router'
import { HeadClient } from '@vueuse/head'

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
   * @default null
   */
  formatting?: null | 'minify' | 'prettify'

  /**
   * Uses .cjs file extension for temporary build file.
   * This should be set to true for es-module environments
   * with type: "module" set in package.json.
   *
   * @default false
   */
  buildCjs?: boolean

  /**
   * Custom functions to modified the routes to do the SSG.
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
  onBeforePageRender?: (route: string, indexHTML: string) => Promise<string | null | undefined> | string | null | undefined

  /**
   * Callback to be called on every page rendered.
   *
   * Also give the change to transform the rendered html by returning a string.
   */
  onPageRendered?: (route: string, renderedHTML: string) => Promise<string | null | undefined> | string | null | undefined

  onFinished?: () => void
}

type PartialKeys<T, Keys extends keyof T> = Omit<T, Keys> & Partial<Pick<T, Keys>>

export interface ViteSSGContext<HasRouter extends boolean = true> {
  app: App<Element>
  router: HasRouter extends true ? Router : undefined
  routes: HasRouter extends true ? RouteRecordRaw[] : undefined
  initialState: Record<string, any>
  head: HeadClient | undefined
  isClient: boolean
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
