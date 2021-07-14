// src/utils/state.ts
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
import { defineComponent } from "vue";
var ClientOnly = defineComponent({
  render() {
    return this.$slots.default && this.$slots.default({});
  }
});

export {
  serializeState,
  deserializeState,
  ClientOnly
};
