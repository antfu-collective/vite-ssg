import type { UserConfig } from 'vite'
import Markdown from 'vite-plugin-vue-markdown'
import Pages from 'vite-plugin-pages'
import Components from 'unplugin-vue-components/vite'
import Vue from '@vitejs/plugin-vue'
import 'vite-ssg'

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
