# Vite SSG

Server-side generation for Vite.

## Install

> ℹ️ **Vite 2 is supported from `v0.2.x`, Vite 1's support is discontinued.**

<pre>
<b>npm i -D vite-ssg</b> <em>vue-router @vue/server-renderer @vue/compiler-sfc</em>
</pre>

```diff
// package.json
{
  "scripts": {
    "dev": "vite",
-   "build": "vite build"
+   "build": "vite-ssg build"
  }
}
```

```ts
// src/main.ts
import { ViteSSG } from 'vite-ssg'
import App from './App.vue'

// `export const createApp` is required
export const createApp = ViteSSG(
  // the root component
  App,
  // vue-router options
  { routes },
  // function to have custom setups
  ({ app, router, isClient }) => {
    // install plugins etc.
  }
)
```

```js
// vite.config.js
import Vue from '@vitejs/plugin-vue'

export default {
  plugins: [
    Vue({
      ssr: !!process.env.VITE_SSG // <-- add this
    })
  ]
}
```

### Client Only

```html
<client-only>
  <your-components>
</client-only>
```

Component `ClientOnly` is registered globally along with the app creation.

## Comparsion

### Use [Vitepress](https://github.com/vuejs/vitepress) when you want:

- Zero config, out-of-box
- Single-purpose documentation site
- Lightweight ([No double payload](https://twitter.com/youyuxi/status/1274834280091389955))

Cons:
- ⛔️ No plugin support, no access to Vite config

### Use Vite SSG when you want:

- More controls on the build process and tooling
- The flexible plugin systems
- Multi-purpose application with some SSG to improve SEO and loading speed

Cons:
- ⛔️ Double payload

## Example

See [Vitesse](https://github.com/antfu/vitesse)

## Thanks to the prior work

- [vitepress](https://github.com/vuejs/vitepress/tree/master/src/node/build)
- [vue3-vite-ssr-example](https://github.com/tbgse/vue3-vite-ssr-example)
- [vite-ssr](https://github.com/frandiox/vite-ssr)

## License

MIT License © 2020 [Anthony Fu](https://github.com/antfu)
