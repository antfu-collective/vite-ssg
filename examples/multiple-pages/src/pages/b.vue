<script lang="ts">
import { useHead } from '@vueuse/head'

export default {
  setup() {
    useHead({
      title: 'Hello',
      meta: [
        {
          name: 'description',
          content: 'Website description',
        },
      ],
      style: [
        {
          children: 'body {color: #567839}',
        },
      ],
    })
  },
  async serverPrefetch() {
    // eslint-disable-next-line no-console
    console.log('prefetch')
  },
}
</script>

<template>
  <p>Hello I am B</p>
  <img src="../assets/test.jpg" alt="">
</template>
