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
          children: 'body {color: #567839}',
        },
      ],
    })
  },
}
</script>

<template>
  <p>Hello I am B</p>
</template>
