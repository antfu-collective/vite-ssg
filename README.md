# vite-ssg

Server-side generation for Vite.

## Install

```bash
npm i -D vite-ssg
```

```diff
{
  "scripts": {
    "dev": "vite",
-    "build": "vite build"
+    "build": "vite-ssg build"
  }
}
```

```ts
// src/main.ts
import { ViteSSG } from 'vite-ssg'
import App from './App.vue'

// `export const createApp` is required
export const createApp = ViteSSG(
  App, // the root component
  { routes }, // vue-router options
  ({ app, router, isClient }) => {

  }
)
```

## Thanks to the Prior works

- [vitepress](https://github.com/vuejs/vitepress/tree/master/src/node/build)
- [vue3-vite-ssr-example](https://github.com/tbgse/vue3-vite-ssr-example)
- [vite-ssr](https://github.com/frandiox/vite-ssr)

## License

MIT License © 2020 [Anthony Fu](https://github.com/antfu)
