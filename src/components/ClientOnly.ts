import { defineComponent, h } from 'vue'

export const ClientOnly = defineComponent({
  render() {
    if (this.$slots.default)
      return h(this.$slots.default, [])
    return null
  },
})
