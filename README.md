# Vite SSG

Server-side generation for Vite.

## Install

<pre>
<b>npm i -D vite-ssg</b> <em>vue-router @vue/server-renderer @vue/compiler-sfc</em>
</pre>

```diff
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

  }
)
```

### Client Only

```html
<client-only>
  <your-components>
</client-only>
```

A component `ClientOnly` is registered globally along with the app creation.

## Example

See [Vitesse](https://github.com/antfu/vitesse).

## Thanks to the Prior works

- [vitepress](https://github.com/vuejs/vitepress/tree/master/src/node/build)
- [vue3-vite-ssr-example](https://github.com/tbgse/vue3-vite-ssr-example)
- [vite-ssr](https://github.com/frandiox/vite-ssr)

## License

MIT License © 2020 [Anthony Fu](https://github.com/antfu)
