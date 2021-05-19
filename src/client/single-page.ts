import { createSSRApp, Component, createApp as createClientApp } from 'vue'
import { createHead, HeadClient } from '@vueuse/head'
import { ViteSSGClientOptions, ViteSSGContext } from '../types'
import { deserializeState, serializeState } from '../utils/state'
import { ClientOnly } from './components/ClientOnly'

export * from '../types'

export function ViteSSG(
  App: Component,
  fn?: (context: ViteSSGContext<false>) => Promise<void> | void,
  options: ViteSSGClientOptions = {},
) {
  const {
    transformState,
    registerComponents = true,
    useHead = true,
    rootContainer = '#app',
  } = options
  const isClient = typeof window !== 'undefined'

  async function createApp(client = false) {
    const app = client
      ? createClientApp(App)
      : createSSRApp(App)

    let head: HeadClient | undefined

    if (useHead) {
      head = createHead()
      app.use(head)
    }

    const context = { app, head, isClient, router: undefined, routes: undefined, initialState: {} }

    if (registerComponents)
      app.component('ClientOnly', client ? ClientOnly : { render: () => null })

    if (client)
      // @ts-ignore
      context.initialState = transformState?.(window.__INITIAL_STATE__ || {}) || deserializeState(window.__INITIAL_STATE__)

    await fn?.(context)

    // serialize initial state for SSR app for it to be interpolated to output HTML
    const initialState = transformState?.(context.initialState) || serializeState(context.initialState)

    return {
      ...context,
      initialState,
    } as ViteSSGContext<false>
  }

  if (isClient) {
    (async() => {
      const { app } = await createApp(true)
      app.mount(rootContainer, true)
    })()
  }

  return createApp
}
