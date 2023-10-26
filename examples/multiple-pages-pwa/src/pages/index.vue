<script lang="ts">
import { useHead } from '@unhead/vue'

export default {
  setup() {
    useHead({
      title: 'INDEX',
    })
  },
}
</script>

<template>
  <RouterLink to="/nested/deep/a">
    A
  </RouterLink>
  <RouterLink to="/b">
    B
  </RouterLink>
</template>
