import { ViteSSG } from 'vite-ssg'
import routes from 'vite-plugin-pages/client'
import App from './App.vue'

export const createApp = ViteSSG(App, { routes })
