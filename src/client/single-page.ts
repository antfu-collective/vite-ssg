import type { VueHeadClient } from '@unhead/vue'
import type { Component } from 'vue'
import type { ViteSSGClientOptions, ViteSSGContext } from '../types'
import { createHead } from '@unhead/vue/client'
import { createHead as createSSRHead } from '@unhead/vue/server'
import { createApp as createClientApp, createSSRApp } from 'vue'
import { documentReady } from '../utils/document-ready'
import { deserializeState } from '../utils/state'
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
    hydration = false,
  } = options
  // eslint-disable-next-line node/prefer-global/process
  const isClient = !!process.env.VITE_SSG

  async function createApp(client = false) {
    // eslint-disable-next-line node/prefer-global/process
    const app = process.env.VITE_SSG
      ? createSSRApp(App)
      : client && !hydration
        ? createClientApp(App)
        : createSSRApp(App)

    let head: VueHeadClient | undefined

    if (useHead) {
      // eslint-disable-next-line node/prefer-global/process
      if (process.env.VITE_SSG) {
        app.use(head = createSSRHead())
      }
      else {
        app.use(head = createHead())
      }
    }

    const appRenderCallbacks: (() => void)[] = []
    // eslint-disable-next-line node/prefer-global/process
    const onSSRAppRendered = !process.env.VITE_SSG && client
      ? () => {}
      : (cb: () => void) => appRenderCallbacks.push(cb)
    const triggerOnSSRAppRendered = () => {
      return Promise.all(appRenderCallbacks.map(cb => cb()))
    }
    const context = { app, head, isClient, router: undefined, routes: undefined, initialState: {}, onSSRAppRendered, triggerOnSSRAppRendered, transformState }

    if (registerComponents)
      app.component('ClientOnly', ClientOnly)

    // eslint-disable-next-line node/prefer-global/process
    if (!process.env.VITE_SSG && client) {
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

  // eslint-disable-next-line node/prefer-global/process
  if (!process.env.VITE_SSG) {
    (async () => {
      const { app } = await createApp(true)
      app.mount(rootContainer, true)
    })()
  }

  return createApp
}
