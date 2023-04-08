import type { Component } from 'vue'
import { createApp as createClientApp, createSSRApp } from 'vue'
import type { HeadClient } from '@vueuse/head'
import { createHead } from '@vueuse/head'
import type { ViteSSGClientOptions, ViteSSGContext } from '../types'
import { deserializeState } from '../utils/state'
import { documentReady } from '../utils/document-ready'
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

    const appRenderCallbacks: Function[] = []
    const onSSRAppRendered = client
      ? () => {}
      : (cb: Function) => appRenderCallbacks.push(cb)
    const triggerOnSSRAppRendered = () => {
      return Promise.all(appRenderCallbacks.map(cb => cb()))
    }
    const context = { app, head, isClient, router: undefined, routes: undefined, initialState: {}, onSSRAppRendered, triggerOnSSRAppRendered, transformState }

    if (registerComponents)
      app.component('ClientOnly', ClientOnly)

    if (client) {
      await documentReady()
      // @ts-expect-error global variable
      context.initialState = transformState?.(window.__INITIAL_STATE__ || {}) || deserializeState(window.__INITIAL_STATE__)
    }

    await fn?.(context)

    // serialize initial state for SSR app for it to be interpolated to output HTML
    const initialState = context.initialState

    return {
      ...context,
      initialState,
    } as ViteSSGContext<false>
  }

  if (isClient) {
    (async () => {
      const { app } = await createApp(true)
      app.mount(rootContainer, true)
    })()
  }

  return createApp
}
