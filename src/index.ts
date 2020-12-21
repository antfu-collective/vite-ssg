import { createSSRApp, Component, App } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory, Router, RouteRecordRaw, RouterOptions as VueRouterOptions } from 'vue-router'

export interface ViteSSGContext {
  app: App<Element>
  router: Router
  routes: RouteRecordRaw[]
  isClient: boolean
}

type PartialKeys<T, Keys extends keyof T> = Omit<T, Keys> & Partial<Pick<T, Keys>>

export type RouterOptions = PartialKeys<VueRouterOptions, 'history'>

export function ViteSSG(
  App: Component,
  routerOptions: RouterOptions,
  fn?: (context: ViteSSGContext) => void,
) {
  const isClient = typeof window !== 'undefined'

  function createApp(client = false) {
    const app = createSSRApp(App)

    const router = createRouter({
      history: client ? createWebHistory() : createMemoryHistory(),
      ...routerOptions,
    })

    const { routes } = routerOptions

    app.use(router)

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
