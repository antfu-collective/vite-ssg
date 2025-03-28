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
  options?: ViteSSGClientOptions,
) {
  const {
    transformState,
    registerComponents = true,
    useHead = true,
    rootContainer = '#app',
  } = options ?? {}

  async function createApp(_client = false) {
    const app = import.meta.env.SSR || options?.hydration
      ? createSSRApp(App)
      : createClientApp(App)

    let head: VueHeadClient | undefined

    if (useHead) {
      app.use(head = import.meta.env.SSR ? createSSRHead() : createHead())
    }

    const appRenderCallbacks: (() => void)[] = []
    const onSSRAppRendered = import.meta.env.SSR
      ? (cb: () => void) => appRenderCallbacks.push(cb)
      : () => {}
    const triggerOnSSRAppRendered = () => {
      return Promise.all(appRenderCallbacks.map(cb => cb()))
    }
    const context = {
      app,
      head,
      isClient: !import.meta.env.SSR,
      router: undefined,
      routes: undefined,
      initialState: {},
      onSSRAppRendered,
      triggerOnSSRAppRendered,
      transformState,
    }

    if (registerComponents)
      app.component('ClientOnly', ClientOnly)

    if (!import.meta.env.SSR) {
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

  if (!import.meta.env.SSR) {
    (async () => {
      const { app } = await createApp()
      app.mount(rootContainer, true)
    })()
  }

  return createApp
}
