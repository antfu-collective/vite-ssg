import { App } from 'vue'
import { Router, RouteRecordRaw, RouterOptions as VueRouterOptions } from 'vue-router'
import { Head } from '@vueuse/head'

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

export interface ViteSSGContext {
  app: App<Element>
  router: Router
  routes: RouteRecordRaw[]
  head: Head
  isClient: boolean
}

declare module 'vite' {
  interface UserConfig {
    ssgOptions?: ViteSSGOptions
  }
}

export interface ViteSSGClientOptions {
  registerComponents?: boolean
}

export type RouterOptions = PartialKeys<VueRouterOptions, 'history'>
