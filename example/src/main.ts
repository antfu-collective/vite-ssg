import { ViteSSG } from 'vite-ssg'
import routes from 'voie-pages'
import App from './App.vue'

export const createApp = ViteSSG(App, { routes })
