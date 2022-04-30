import type { UserConfig } from 'vite'
import {} from 'vite-ssg'
import Markdown from 'vite-plugin-md'
import Pages from 'vite-plugin-pages'
import Components from 'unplugin-vue-components/vite'
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
      extensions: ['vue', 'md'],
      // allow auto import and register components used in markdown
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
    }),
  ],
  ssgOptions: {
    script: 'async',
    formatting: 'prettify',
  },
}

export default config
