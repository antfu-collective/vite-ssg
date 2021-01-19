import { defineComponent } from 'vue'

export const ClientOnly = defineComponent({
  render() {
    return this.$slots.default && this.$slots.default({})
  },
})
