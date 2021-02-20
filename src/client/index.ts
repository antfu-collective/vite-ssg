import { createSSRApp, Component, createApp as createClientApp } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import { createHead, Head } from '@vueuse/head'
import { RouterOptions, ViteSSGContext, ViteSSGClientOptions } from '../types'
import { ClientOnly } from './components/ClientOnly'

export * from '../types'

type ExtRouterOptions = RouterOptions & {
  isWebHashHistory: boolean
}

export function ViteSSG(
  App: Component,
  routerOptions: ExtRouterOptions,
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

    let head: Head | undefined

    if (useHead) {
      head = createHead()
      app.use(head)
    }

    const { isWebHashHistory } = routerOptions

    const router = createRouter({
      history: client
        ? isWebHashHistory
          ? createWebHashHistory()
          : createWebHistory()
        : createMemoryHistory(),
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
