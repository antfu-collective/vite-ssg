<template>
  <h2>Hello</h2>
  <p>World</p>
</template>

<script setup lang="ts">
import { useHead } from '@vueuse/head'

useHead({
  title: 'Hello World',
})
</script>

<style>
#app {
  padding: 4em 8em;
  font-family: sans-serif;
}
</style>
