/* eslint-disable @typescript-eslint/no-var-requires */
import { createSSRApp, Component, createApp as createClientApp } from 'vue'
import { createHead } from '@vueuse/head'
import { RouterOptions, ViteSSGContext, ViteSSGClientOptions } from '../types'
import { ClientOnly } from './components/ClientOnly'

export * from '../types'

export function ViteSSG(
  App: Component,
  routerOptions?: null | undefined,
  fn?: (context: ViteSSGContext<false>) => void,
  options?: ViteSSGClientOptions,
): (client?: boolean) => ViteSSGContext<false>
export function ViteSSG(
  App: Component,
  routerOptions: RouterOptions,
  fn?: (context: ViteSSGContext<true>) => void,
  options?: ViteSSGClientOptions,
): (client?: boolean) => ViteSSGContext<true>

export function ViteSSG(
  App: Component,
  routerOptions?: RouterOptions | null | undefined,
  fn?: (context: any) => void,
  options: ViteSSGClientOptions = {},
): (client?: boolean) => ViteSSGContext<false> | ViteSSGContext<true> {
  const { registerComponents = true } = options
  const isClient = typeof window !== 'undefined'

  function createApp(client = false) {
    const app = client
      ? createClientApp(App)
      : createSSRApp(App)

    let context: ViteSSGContext<false> | ViteSSGContext<true>

    const head = createHead()

    app.use(head)

    if (routerOptions) {
      const { createMemoryHistory, createRouter, createWebHistory } = require('vue-router')

      const router = createRouter({
        history: client ? createWebHistory() : createMemoryHistory(),
        ...routerOptions,
      })

      const { routes } = routerOptions

      app.use(router)

      context = { app, head, isClient, router, routes }
    }
    else {
      context = { app, head, isClient, router: undefined, routes: undefined }
    }

    if (registerComponents)
      app.component('ClientOnly', client ? ClientOnly : { render: () => null })

    fn && fn(context)

    return context
  }

  if (isClient) {
    const { app, router } = createApp(true)

    // wait until page component is fetched before mounting
    if (router) {
      router.isReady().then(() => {
        app.mount('#app', true)
      })
    }
    else {
      app.mount('#app', true)
    }
  }

  return createApp
}
