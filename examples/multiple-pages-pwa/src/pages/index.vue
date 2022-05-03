<script lang="ts">
import { useHead } from '@vueuse/head'

export default {
  setup() {
    useHead({
      title: 'INDEX',
    })
  },
}
</script>

<template>
  <router-link to="/nested/deep/a">
    A
  </router-link>
  <router-link to="/b">
    B
  </router-link>
</template>
