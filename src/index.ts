import { createSSRApp, Component, App } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory, Router, RouteRecordRaw } from 'vue-router'

export interface ViteSSGContext {
  app: App<Element>
  router: Router
  routes: RouteRecordRaw[]
  isClient: boolean
}

export async function ViteSSG(
  App: Component,
  _routes: RouteRecordRaw[] | 'voie-pages' = 'voie-pages',
  fn?: (context: ViteSSGContext) => void,
) {
  const isClient = typeof window !== 'undefined'

  const routes: RouteRecordRaw[] = typeof _routes === 'string'
    ? require(_routes)
    : _routes

  function createApp(client = false) {
    const app = createSSRApp(App)

    const router = createRouter({
      history: client ? createWebHistory() : createMemoryHistory(),
      routes,
    })

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
