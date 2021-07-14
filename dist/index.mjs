import {
  ClientOnly,
  deserializeState,
  serializeState
} from "./chunk-QQ6W5TO2.mjs";
import {
  __spreadProps,
  __spreadValues
} from "./chunk-SO7PDUCV.mjs";

// src/client/index.ts
import { createSSRApp, createApp as createClientApp } from "vue";
import { createMemoryHistory, createRouter, createWebHistory } from "vue-router";
import { createHead } from "@vueuse/head";
function ViteSSG(App, routerOptions, fn, options = {}) {
  const {
    transformState,
    registerComponents = true,
    useHead = true,
    rootContainer = "#app"
  } = options;
  const isClient = typeof window !== "undefined";
  async function createApp(client = false) {
    const app = client ? createClientApp(App) : createSSRApp(App);
    let head;
    if (useHead) {
      head = createHead();
      app.use(head);
    }
    const router = createRouter(__spreadValues({
      history: client ? createWebHistory(routerOptions.base) : createMemoryHistory(routerOptions.base)
    }, routerOptions));
    const { routes } = routerOptions;
    app.use(router);
    if (registerComponents)
      app.component("ClientOnly", client ? ClientOnly : { render: () => null });
    const context = { app, head, isClient, router, routes, initialState: {} };
    if (client)
      context.initialState = (transformState == null ? void 0 : transformState(window.__INITIAL_STATE__ || {})) || deserializeState(window.__INITIAL_STATE__);
    await (fn == null ? void 0 : fn(context));
    let entryRoutePath;
    let isFirstRoute = true;
    router.beforeEach((to, from, next) => {
      if (isFirstRoute || entryRoutePath && entryRoutePath === to.path) {
        isFirstRoute = false;
        entryRoutePath = to.path;
        to.meta.state = context.initialState;
      }
      next();
    });
    if (!client) {
      router.push(routerOptions.base || "/");
      await router.isReady();
      context.initialState = router.currentRoute.value.meta.state || {};
    }
    const initialState = (transformState == null ? void 0 : transformState(context.initialState)) || serializeState(context.initialState);
    return __spreadProps(__spreadValues({}, context), {
      initialState
    });
  }
  if (isClient) {
    (async () => {
      const { app, router } = await createApp(true);
      await router.isReady();
      app.mount(rootContainer, true);
    })();
  }
  return createApp;
}
export {
  ViteSSG
};
