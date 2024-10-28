import routes from '~pages'
import { ViteSSG } from 'vite-ssg'
import App from './App.vue'

export const createApp = ViteSSG(App, {
  base: import.meta.env.BASE_URL,
  routes,
})
