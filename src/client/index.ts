import { createSSRApp, Component, App, createApp as createClientApp } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory, Router, RouteRecordRaw, RouterOptions as VueRouterOptions } from 'vue-router'
import { createHead } from '@vueuse/head'
import { ClientOnly } from './components/ClientOnly'

type PartialKeys<T, Keys extends keyof T> = Omit<T, Keys> & Partial<Pick<T, Keys>>
type ReturnType<T> = T extends () => infer R ? R: never

export type Head = ReturnType<typeof createHead>

export interface ViteSSGContext {
  app: App<Element>
  router: Router
  routes: RouteRecordRaw[]
  head: Head
  isClient: boolean
}

export interface ViteSSGOptions {
  registerComponents?: boolean
}

export type RouterOptions = PartialKeys<VueRouterOptions, 'history'>

export function ViteSSG(
  App: Component,
  routerOptions: RouterOptions,
  fn?: (context: ViteSSGContext) => void,
  options: ViteSSGOptions = {},
) {
  const { registerComponents = true } = options
  const isClient = typeof window !== 'undefined'

  function createApp(client = false) {
    const app = client
      ? createClientApp(App)
      : createSSRApp(App)

    const router = createRouter({
      history: client ? createWebHistory() : createMemoryHistory(),
      ...routerOptions,
    })

    const head = createHead()

    const { routes } = routerOptions

    app.use(router)
    app.use(head)

    if (registerComponents)
      app.component('ClientOnly', client ? ClientOnly : { render: () => null })

    const context: ViteSSGContext = { app, router, routes, head, isClient }

    fn && fn(context)

    return context
  }

  if (isClient) {
    const { app, router } = createApp(true)

    // wait until page component is fetched before mounting
    router.isReady().then(() => {
      app.mount('#app', true)
    })
  }

  return createApp
}
