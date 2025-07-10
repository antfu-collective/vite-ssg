<script lang="ts">
import { useHead } from '@unhead/vue'

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
          textContent: 'body {color: #567839}',
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
