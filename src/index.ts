import { createSSRApp, Component, App, createApp as createClientApp } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory, Router, RouteRecordRaw, RouterOptions as VueRouterOptions } from 'vue-router'
import { ClientOnly } from './components/ClientOnly'

export interface ViteSSGContext {
  app: App<Element>
  router: Router
  routes: RouteRecordRaw[]
  isClient: boolean
}

export interface ViteSSGOptions {
  registerComponents?: boolean
}

type PartialKeys<T, Keys extends keyof T> = Omit<T, Keys> & Partial<Pick<T, Keys>>

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

    const { routes } = routerOptions

    app.use(router)

    if (registerComponents)
      app.component('ClientOnly', client ? ClientOnly : { render: () => null })

    const context: ViteSSGContext = { app, router, routes, isClient }

    fn && fn(context)

    return context
  }

  if (isClient) {
    const { app, router } = createApp(true)

    // wait unitl page component is fetched before mounting
    router.isReady().then(() => {
      app.mount('#app', true)
    })
  }

  return createApp
}
