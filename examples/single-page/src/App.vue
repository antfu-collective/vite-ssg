<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { useRootStore } from './store/root'

useHead({
  title: 'Hello World',
})

const store = useRootStore()
</script>

<template>
  <h2>Hello</h2>
  <p>World</p>

  <h3>Initial State:</h3>
  <pre>{{ store.user }}</pre>
</template>

<style>
#app {
  padding: 4em 8em;
  font-family: sans-serif;
}
</style>
