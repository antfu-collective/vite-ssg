import { createSSRApp, Component, createApp as createClientApp } from 'vue'
import { createHead, HeadClient } from '@vueuse/head'
import { ViteSSGClientOptions, ViteSSGContext } from '../types'
import { ClientOnly } from './components/ClientOnly'

export * from '../types'

export function ViteSSG(
  App: Component,
  fn?: (context: ViteSSGContext<false>) => void,
  options: ViteSSGClientOptions = {},
) {
  const {
    registerComponents = true,
    useHead = true,
    rootContainer = "#app",
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

    const context = { app, head, isClient, router: undefined, routes: undefined }

    if (registerComponents)
      app.component('ClientOnly', client ? ClientOnly : { render: () => null })

    fn && fn(context)

    return context
  }

  if (isClient) {
    const { app } = createApp(true)
    app.mount(rootContainer, true)
  }

  return createApp
}
