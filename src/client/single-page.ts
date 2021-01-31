import { createSSRApp, Component, createApp as createClientApp } from 'vue'
import { createHead } from '@vueuse/head'
import { ClientOnly } from './components/ClientOnly'
import { ViteSSGClientOptions, ViteSSGContext } from '../types'

export * from '../types'

export function ViteSSG(
  App: Component,
  fn?: (context: ViteSSGContext<false>) => void,
  options: ViteSSGClientOptions = {},
) {
  const { registerComponents = true } = options
  const isClient = typeof window !== 'undefined'

  function createApp(client = false) {
    const app = client
      ? createClientApp(App)
      : createSSRApp(App)

    let context: ViteSSGContext<false>

    const head = createHead()

    app.use(head)

    context = { app, head, isClient, router: undefined, routes: undefined }

    if (registerComponents)
      app.component('ClientOnly', client ? ClientOnly : { render: () => null })

    fn && fn(context)

    return context
  }

  if (isClient) {
    const { app } = createApp(true)
    app.mount('#app', true)
  }

  return createApp
}
