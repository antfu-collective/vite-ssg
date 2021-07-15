import { UserConfig } from 'vite'
import {} from 'vite-ssg'
import Markdown from 'vite-plugin-md'
import Pages from 'vite-plugin-pages'
import Components from 'vite-plugin-components'
import Vue from '@vitejs/plugin-vue'

const config: UserConfig = {
  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
    }),
    Pages({
      extensions: ['vue', 'md'],
    }),
    Markdown({
      headEnabled: true,
    }),
    Components({
      customLoaderMatcher: path => path.endsWith('.md'),
    }),
  ],
  ssgOptions: {
    script: 'async',
    formatting: 'prettify',
  },
}

export default config
