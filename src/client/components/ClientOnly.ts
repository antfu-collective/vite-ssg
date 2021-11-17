import { defineComponent, onMounted, ref } from 'vue'

export const ClientOnly = defineComponent({
  setup(props, { slots }) {
    const mounted = ref(false)
    onMounted(() => (mounted.value = true))

    return () => {
      return mounted.value && slots.default && slots.default({})
    }
  },
})
