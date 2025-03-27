import type { VueHeadClient } from '@unhead/vue'
import type { Component } from 'vue'
import type { RouterOptions, ViteSSGClientOptions, ViteSSGContext } from '../../types'
import { createHead } from '@unhead/vue/client'
import { createApp as createClientApp } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import { ClientOnly } from './components/ClientOnly'
import { documentReady } from './utils/document-ready'
import { deserializeState } from './utils/state'

export * from '../../types'

export function ViteSSG(
  App: Component,
  routerOptions: RouterOptions,
  fn?: (context: ViteSSGContext<true>) => Promise<void> | void,
  options: ViteSSGClientOptions = {},
) {
  const {
    transformState,
    registerComponents = true,
    useHead = true,
    rootContainer = '#app',
    hydration = false,
  } = options
  const isClient = typeof window !== 'undefined'

  async function createApp(client = false, routePath?: string) {
    const app = createClientApp(App)

    let head: VueHeadClient | undefined

    if (useHead) {
      app.use(head = createHead())
    }

    const router = createRouter({
      history: client
        ? createWebHistory(routerOptions.base)
        : createMemoryHistory(routerOptions.base),
      ...routerOptions,
    })
    app.use(router)

    const { routes } = routerOptions

    if (registerComponents)
      app.component('ClientOnly', ClientOnly)

    const appRenderCallbacks: (() => void)[] = []
    const onSSRAppRendered = client
      ? () => {}
      : (cb: () => void) => appRenderCallbacks.push(cb)
    const triggerOnSSRAppRendered = () => {
      return Promise.all(appRenderCallbacks.map(cb => cb()))
    }
    const context: ViteSSGContext<true> = {
      app,
      head,
      isClient,
      router,
      routes,
      onSSRAppRendered,
      triggerOnSSRAppRendered,
      initialState: {},
      transformState,
      routePath,
    }

    await documentReady()
    // @ts-expect-error global variable
    context.initialState = transformState?.(window.__INITIAL_STATE__ || {}) || deserializeState(window.__INITIAL_STATE__)

    await fn?.(context)

    let entryRoutePath: string | undefined
    let isFirstRoute = true
    router.beforeEach((to, from, next) => {
      if (isFirstRoute || (entryRoutePath && entryRoutePath === to.path)) {
        // The first route is rendered in the server and its state is provided globally.
        isFirstRoute = false
        entryRoutePath = to.path
        to.meta.state = context.initialState
      }

      next()
    })

    const initialState = context.initialState

    return {
      ...context,
      initialState,
    } as ViteSSGContext<true>
  }

  (async () => {
    const { app, router } = await createApp(true)
    // wait until page component is fetched before mounting
    await router.isReady()
    app.mount(rootContainer, true)
  })()

  return createApp
}
