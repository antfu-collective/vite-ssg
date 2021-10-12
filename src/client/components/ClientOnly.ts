import { defineComponent, onMounted, ref } from "vue";

export const ClientOnly = defineComponent({
  setup() {
    const mounted = ref(false);
    onMounted(() => (mounted.value = true));

    return {
      mounted,
    };
  },
  render() {
    return this.mounted && this.$slots.default && this.$slots.default({});
  },
});
