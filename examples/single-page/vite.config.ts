import type { UserConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'

const config: UserConfig = {
  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
    }),
  ],
  ssgOptions: {
    script: 'async',
    format: 'cjs',
    formatting: 'prettify',
  },
}

export default config
