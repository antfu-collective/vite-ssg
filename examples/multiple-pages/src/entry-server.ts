import { ViteSSG } from 'vite-ssg/server'
import routes from '~pages'
import App from './App.vue'

export const createApp = ViteSSG(App, {
  base: import.meta.env.BASE_URL,
  routes,
})
