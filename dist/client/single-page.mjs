import {
  ClientOnly,
  deserializeState,
  serializeState
} from "../chunk-QQ6W5TO2.mjs";
import {
  __spreadProps,
  __spreadValues
} from "../chunk-SO7PDUCV.mjs";

// src/client/single-page.ts
import { createSSRApp, createApp as createClientApp } from "vue";
import { createHead } from "@vueuse/head";
function ViteSSG(App, fn, options = {}) {
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
    const context = { app, head, isClient, router: void 0, routes: void 0, initialState: {} };
    if (registerComponents)
      app.component("ClientOnly", client ? ClientOnly : { render: () => null });
    if (client)
      context.initialState = (transformState == null ? void 0 : transformState(window.__INITIAL_STATE__ || {})) || deserializeState(window.__INITIAL_STATE__);
    await (fn == null ? void 0 : fn(context));
    const initialState = (transformState == null ? void 0 : transformState(context.initialState)) || serializeState(context.initialState);
    return __spreadProps(__spreadValues({}, context), {
      initialState
    });
  }
  if (isClient) {
    (async () => {
      const { app } = await createApp(true);
      app.mount(rootContainer, true);
    })();
  }
  return createApp;
}
export {
  ViteSSG
};
