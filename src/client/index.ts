import type { VueHeadClient } from '@unhead/vue'
import type { Component } from 'vue'
import type { RouterOptions, ViteSSGClientOptions, ViteSSGContext } from '../types'
import { createHead } from '@unhead/vue/client'
import { createHead as createSSRHead } from '@unhead/vue/server'
import { createApp as createClientApp, createSSRApp } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import { documentReady } from '../utils/document-ready'
import { deserializeState } from '../utils/state'
import { ClientOnly } from './components/ClientOnly'

export * from '../types'

export function ViteSSG(
  App: Component,
  routerOptions: RouterOptions,
  fn?: (context: ViteSSGContext<true>) => Promise<void> | void,
  options?: ViteSSGClientOptions,
) {
  const {
    transformState,
    registerComponents = true,
    useHead = true,
    rootContainer = '#app',
  } = options ?? {}

  async function createApp(routePath?: string) {
    const app = import.meta.env.SSR || options?.hydration
      ? createSSRApp(App)
      : createClientApp(App)

    let head: VueHeadClient | undefined

    if (useHead) {
      app.use(head = import.meta.env.SSR ? createSSRHead() : createHead())
    }

    const router = createRouter({
      history: import.meta.env.SSR
        ? createMemoryHistory(routerOptions.base)
        : createWebHistory(routerOptions.base),
      ...routerOptions,
    })

    const { routes } = routerOptions

    if (registerComponents)
      app.component('ClientOnly', ClientOnly)

    const appRenderCallbacks: (() => void)[] = []
    const onSSRAppRendered = import.meta.env.SSR
      ? (cb: () => void) => appRenderCallbacks.push(cb)
      : () => {}
    const triggerOnSSRAppRendered = () => {
      return Promise.all(appRenderCallbacks.map(cb => cb()))
    }
    const context: ViteSSGContext<true> = {
      app,
      head,
      isClient: !import.meta.env.SSR,
      router,
      routes,
      onSSRAppRendered,
      triggerOnSSRAppRendered,
      initialState: {},
      transformState,
      routePath,
    }

    if (!import.meta.env.SSR) {
      await documentReady()
      // @ts-expect-error global variable
      context.initialState = transformState?.(window.__INITIAL_STATE__ || {}) || deserializeState(window.__INITIAL_STATE__)
    }

    await fn?.(context)

    app.use(router)

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

    if (!import.meta.env.SSR) {
      const route = context.routePath ?? '/'
      router.push(route)

      await router.isReady()
      context.initialState = router.currentRoute.value.meta.state as Record<string, any> || {}
    }

    const initialState = context.initialState

    return {
      ...context,
      initialState,
    } as ViteSSGContext<true>
  }

  if (!import.meta.env.SSR) {
    (async () => {
      const { app, router } = await createApp()
      // wait until page component is fetched before mounting
      await router.isReady()
      app.mount(rootContainer, true)
    })()
  }

  return createApp
}
