"use strict";Object.defineProperty(exports, "__esModule", {value: true});



var _chunk3E7O3SQEjs = require('./chunk-3E7O3SQE.js');



var _chunk3FHQZVYOjs = require('./chunk-3FHQZVYO.js');

// src/client/index.ts
var _vue = require('vue');
var _vuerouter = require('vue-router');
var _head = require('@vueuse/head');
function ViteSSG(App, routerOptions, fn, options = {}) {
  const {
    transformState,
    registerComponents = true,
    useHead = true,
    rootContainer = "#app"
  } = options;
  const isClient = typeof window !== "undefined";
  async function createApp(client = false) {
    const app = client ? _vue.createApp.call(void 0, App) : _vue.createSSRApp.call(void 0, App);
    let head;
    if (useHead) {
      head = _head.createHead.call(void 0, );
      app.use(head);
    }
    const router = _vuerouter.createRouter.call(void 0, _chunk3FHQZVYOjs.__spreadValues.call(void 0, {
      history: client ? _vuerouter.createWebHistory.call(void 0, routerOptions.base) : _vuerouter.createMemoryHistory.call(void 0, routerOptions.base)
    }, routerOptions));
    const { routes } = routerOptions;
    app.use(router);
    if (registerComponents)
      app.component("ClientOnly", client ? _chunk3E7O3SQEjs.ClientOnly : { render: () => null });
    const context = { app, head, isClient, router, routes, initialState: {} };
    if (client)
      context.initialState = (transformState == null ? void 0 : transformState(window.__INITIAL_STATE__ || {})) || _chunk3E7O3SQEjs.deserializeState.call(void 0, window.__INITIAL_STATE__);
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
    const initialState = (transformState == null ? void 0 : transformState(context.initialState)) || _chunk3E7O3SQEjs.serializeState.call(void 0, context.initialState);
    return _chunk3FHQZVYOjs.__spreadProps.call(void 0, _chunk3FHQZVYOjs.__spreadValues.call(void 0, {}, context), {
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


exports.ViteSSG = ViteSSG;
