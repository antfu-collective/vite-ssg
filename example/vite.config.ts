import { UserConfig } from 'vite'
import Markdown from 'vite-plugin-md'
import Voie from 'vite-plugin-voie'
import Components from 'vite-plugin-components'
import Vue from '@vitejs/plugin-vue'

const config: UserConfig = {
  plugins: [
    Vue({
      ssr: !!process.env.VITE_SSG,
    }),
    Voie({
      extensions: ['vue', 'md'],
    }),
    Markdown(),
    Components({
      customLoaderMatcher: path => path.endsWith('.md'),
    }),
  ],
}

export default config
