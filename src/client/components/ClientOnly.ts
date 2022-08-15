import { defineComponent, onMounted, ref } from 'vue'

export const ClientOnly = defineComponent({
  setup(props, { slots }) {
    const mounted = ref(false)
    onMounted(() => (mounted.value = true))

    return () => {
      if (!mounted.value)
        return slots.placeholder && slots.placeholder({})

      return slots.default && slots.default({})
    }
  },
})
