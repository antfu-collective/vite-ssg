import { createSSRApp, Component, createApp as createClientApp } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import { createHead, HeadClient } from '@vueuse/head'
import { deserializeState, serializeState } from '../utils/state'
import type { RouterOptions, ViteSSGContext, ViteSSGClientOptions } from '../types'
import { ClientOnly } from './components/ClientOnly'

export * from '../types'

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
  } = options
  const isClient = typeof window !== 'undefined'

  async function createApp(client = false, routePath?: string) {
    const app = client
      ? createClientApp(App)
      : createSSRApp(App)

    let head: HeadClient | undefined

    if (useHead) {
      head = createHead()
      app.use(head)
    }

    const router = createRouter({
      history: client
        ? createWebHistory(routerOptions.base)
        : createMemoryHistory(routerOptions.base),
      ...routerOptions,
    })

    const { routes } = routerOptions

    if (registerComponents)
      app.component('ClientOnly', client ? ClientOnly : { render: () => null })

    const context: ViteSSGContext<true> = {
      app,
      head,
      isClient,
      router,
      routes,
      initialState: {},
      routePath,
    }

    if (client)
      // @ts-ignore
      context.initialState = transformState?.(window.__INITIAL_STATE__ || {}) || deserializeState(window.__INITIAL_STATE__)

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

    if (!client) {
      const route = context.routePath ?? routerOptions.base ?? '/'
      router.push(route)

      await router.isReady()
      context.initialState = router.currentRoute.value.meta.state as Record<string, any> || {}
    }

    // serialize initial state for SSR app for it to be interpolated to output HTML
    const initialState = transformState?.(context.initialState) || serializeState(context.initialState)

    return {
      ...context,
      initialState,
    } as ViteSSGContext<true>
  }

  if (isClient) {
    (async() => {
      const { app, router } = await createApp(true)
      // wait until page component is fetched before mounting
      await router.isReady()
      app.mount(rootContainer, true)
    })()
  }

  return createApp
}
