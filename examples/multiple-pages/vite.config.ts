import type { UserConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import Pages from 'vite-plugin-pages'

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
