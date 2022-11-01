<script lang="ts">
import { computed } from 'vue'
import { useHead } from '@vueuse/head'
import { useRootStore } from '../store/root'

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

    const store = useRootStore()

    return {
      user: computed(() => store.user),
    }
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
  <pre>
    {{ JSON.stringify(user) }}
  </pre>
</template>
