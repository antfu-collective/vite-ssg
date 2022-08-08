import devalue from '@nuxt/devalue'
import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import { useRootStore } from './store/root'
import App from './App.vue'
import routes from '~pages'

export const createApp = ViteSSG(
  App,
  { routes },
  ({ app, router, initialState }) => {
    const pinia = createPinia()
    app.use(pinia)

    if (import.meta.env.SSR) {
      // this will be stringified and set to window.__INITIAL_STATE__
      initialState.pinia = pinia.state.value
    }
    else {
      // on the client side, we restore the state
      pinia.state.value = initialState?.pinia || {}
    }

    router.beforeEach((to, from, next) => {
      const store = useRootStore(pinia)

      store.initialize()
      next()
    })
  },
  {
    transformState(state) {
      return import.meta.env.SSR ? devalue(state) : state
    },
  },
)
