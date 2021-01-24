import { createSSRApp, Component, createApp as createClientApp } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import { createHead } from '@vueuse/head'
import { RouterOptions, ViteSSGContext, ViteSSGClientOptions } from '../types'
import { ClientOnly } from './components/ClientOnly'

export * from '../types'

export function ViteSSG(
  App: Component,
  routerOptions: RouterOptions,
  fn?: (context: ViteSSGContext) => void,
  options: ViteSSGClientOptions = {},
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
