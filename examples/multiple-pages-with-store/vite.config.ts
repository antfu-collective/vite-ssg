import type { UserConfig } from 'vite'
import process from 'node:process'
import Vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import Pages from 'vite-plugin-pages'
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
    dirStyle: process.env.NESTED_PAGES === 'true' ? 'nested' : 'flat',
    formatting: 'prettify',
  },
}

export default config
