import type { VueHeadClient } from '@unhead/vue'
import type { Component } from 'vue'
import type { RouterOptions, ViteSSGClientOptions, ViteSSGContext } from '../../types'
import { createHead as createSSRHead } from '@unhead/vue/server'
import { createSSRApp } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import { ClientOnly } from './components/ClientOnly'

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

  async function createApp(client = false, routePath?: string) {
    const app = createSSRApp(App)

    let head: VueHeadClient | undefined

    if (useHead) {
      app.use(head = createSSRHead())
    }

    const router = createRouter({
      history: client
        ? createWebHistory(routerOptions.base)
        : createMemoryHistory(routerOptions.base),
      ...routerOptions,
    })

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
      isClient: false,
      router,
      routes,
      onSSRAppRendered,
      triggerOnSSRAppRendered,
      initialState: {},
      transformState,
      routePath,
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

    const route = context.routePath ?? '/'
    router.push(route)

    await router.isReady()
    context.initialState = router.currentRoute.value.meta.state as Record<string, any> || {}

    const initialState = context.initialState

    return {
      ...context,
      initialState,
    } as ViteSSGContext<true>
  }

  return createApp
}
