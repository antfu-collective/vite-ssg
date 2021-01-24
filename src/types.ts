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
   * Mock browser global variables (window, document, etc.) for SSG
   *
   * @default false
   */
  mock?: boolean

  onBeforeRouteRender?: (route: string) => void
  onRouterRendered?: (route: string) => void

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
