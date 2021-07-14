"use strict";Object.defineProperty(exports, "__esModule", {value: true});// src/utils/state.ts
var UNSAFE_CHARS_REGEXP = /[<>\/\u2028\u2029]/g;
var ESCAPED_CHARS = {
  "<": "\\u003C",
  ">": "\\u003E",
  "/": "\\u002F",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
};
function escapeUnsafeChars(unsafeChar) {
  return ESCAPED_CHARS[unsafeChar];
}
function serializeState(state) {
  try {
    return JSON.stringify(JSON.stringify(state || {})).replace(UNSAFE_CHARS_REGEXP, escapeUnsafeChars);
  } catch (error) {
    console.error("[SSG] On state serialization -", error, state);
    return "{}";
  }
}
function deserializeState(state) {
  try {
    return JSON.parse(state || "{}");
  } catch (error) {
    console.error("[SSG] On state deserialization -", error, state);
    return {};
  }
}

// src/client/components/ClientOnly.ts
var _vue = require('vue');
var ClientOnly = _vue.defineComponent.call(void 0, {
  render() {
    return this.$slots.default && this.$slots.default({});
  }
});





exports.serializeState = serializeState; exports.deserializeState = deserializeState; exports.ClientOnly = ClientOnly;
