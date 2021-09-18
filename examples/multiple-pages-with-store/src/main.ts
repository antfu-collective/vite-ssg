import devalue from '@nuxt/devalue'
import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import routes from 'virtual:generated-pages'
import { useRootStore } from './store/root'
import App from './App.vue'

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

    const store = useRootStore(pinia)
    store.initialize()
  },
  {
    transformState(state) {
      return import.meta.env.SSR ? devalue(state) : state
    },
  },
)
