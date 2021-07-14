"use strict";Object.defineProperty(exports, "__esModule", {value: true});



var _chunk3E7O3SQEjs = require('../chunk-3E7O3SQE.js');



var _chunk3FHQZVYOjs = require('../chunk-3FHQZVYO.js');

// src/client/single-page.ts
var _vue = require('vue');
var _head = require('@vueuse/head');
function ViteSSG(App, fn, options = {}) {
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
    const context = { app, head, isClient, router: void 0, routes: void 0, initialState: {} };
    if (registerComponents)
      app.component("ClientOnly", client ? _chunk3E7O3SQEjs.ClientOnly : { render: () => null });
    if (client)
      context.initialState = (transformState == null ? void 0 : transformState(window.__INITIAL_STATE__ || {})) || _chunk3E7O3SQEjs.deserializeState.call(void 0, window.__INITIAL_STATE__);
    await (fn == null ? void 0 : fn(context));
    const initialState = (transformState == null ? void 0 : transformState(context.initialState)) || _chunk3E7O3SQEjs.serializeState.call(void 0, context.initialState);
    return _chunk3FHQZVYOjs.__spreadProps.call(void 0, _chunk3FHQZVYOjs.__spreadValues.call(void 0, {}, context), {
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


exports.ViteSSG = ViteSSG;
