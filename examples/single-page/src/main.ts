import { createPinia } from 'pinia'
import { ViteSSG } from 'vite-ssg/single-page'
import { useRootStore } from './store/root'
import App from './App.vue'

export const createApp = ViteSSG(
  App,
  ({ app, initialState }) => {
    const pinia = createPinia()
    app.use(pinia)

    if (import.meta.env.SSR) {
      // this will be stringified and set to window.__INITIAL_STATE__
      initialState.pinia = pinia.state.value
    }
    else {
      // on the client side, we restore the state
      pinia.state.value = initialState.pinia || {}
    }

    const store = useRootStore(pinia)
    store.initialize()
  },
)
