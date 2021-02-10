import { createSSRApp, Component, createApp as createClientApp } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import { createHead, Head } from '@vueuse/head'
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

    let context: ViteSSGContext<true>
    let head: Head | undefined

    if (useHead) {
      head = createHead()
      app.use(head)
    }

    const router = createRouter({
      history: client ? createWebHistory() : createMemoryHistory(),
      ...routerOptions,
    })

    const { routes } = routerOptions

    app.use(router)

    context = { app, head, isClient, router, routes }

    if (registerComponents)
      app.component('ClientOnly', client ? ClientOnly : { render: () => null })

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
