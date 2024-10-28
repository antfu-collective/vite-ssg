import type { UserConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Pages from 'vite-plugin-pages'
import { VitePWA } from 'vite-plugin-pwa'

const config: UserConfig = {
  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
    }),
    Pages({
      extensions: ['vue', 'md'],
    }),
    VitePWA({
      minify: false,
      mode: 'development',
    }),
  ],
  ssgOptions: {
    script: 'async',
    formatting: 'prettify',
  },
}

export default config
