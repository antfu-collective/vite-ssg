import { createSSRApp, Component, createApp as createClientApp } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import { createHead, HeadClient } from '@vueuse/head'
import { RouterOptions, ViteSSGContext, ViteSSGClientOptions } from '../types'
import { ClientOnly } from './components/ClientOnly'

export * from '../types'

export function ViteSSG(
  App: Component,
  routerOptions: RouterOptions,
  fn?: (context: ViteSSGContext<true>) => void,
  options: ViteSSGClientOptions = {},
) {
  const {
    registerComponents = true,
    useHead = true,
  } = options
  const isClient = typeof window !== 'undefined'

  function createApp(client = false) {
    const app = client
      ? createClientApp(App)
      : createSSRApp(App)

    let head: HeadClient | undefined

    if (useHead) {
      head = createHead()
      app.use(head)
    }

    const router = createRouter({
      history: client
        ? createWebHistory(routerOptions.base)
        : createMemoryHistory(routerOptions.base),
      ...routerOptions,
    })

    const { routes } = routerOptions

    app.use(router)

    if (registerComponents)
      app.component('ClientOnly', client ? ClientOnly : { render: () => null })

    const context: ViteSSGContext<true> = { app, head, isClient, router, routes }

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
