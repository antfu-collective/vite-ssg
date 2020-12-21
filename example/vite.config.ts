import { UserConfig } from 'vite'
import Markdown from 'vite-plugin-md'
import Voie from 'vite-plugin-voie'
import Components from 'vite-plugin-components'

const config: UserConfig = {
  plugins: [
    Voie({
      extensions: ['vue', 'md'],
    }),
    Markdown(),
    Components({
      customLoaderMatcher: ctx => ctx.path.endsWith('.md'),
    }),
  ],
}

export default config
