<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useRootStore } from './store/root'

useHead({
  title: 'Hello World',
  htmlAttrs: { lang: 'en' },
  bodyAttrs: { class: 'single-page' },
  meta: [{ name: 'description', content: 'A single page example' }],
  script: [
    { id: 'body-open', type: 'application/json', innerHTML: '{"position":"open"}', tagPosition: 'bodyOpen' },
    { id: 'body-close', type: 'application/json', innerHTML: '{"position":"close"}', tagPosition: 'bodyClose' },
  ],
})

const store = useRootStore()
</script>

<template>
  <h2>Hello</h2>
  <p>World</p>

  <h3>Initial State:</h3>
  <pre>{{ store.user }}</pre>

  <a href="https://github.com/antfu/vite-ssg" aria-label="Permalink to &quot;Usage `^`, `$`&quot;" />
</template>

<style>
#app {
  padding: 4em 8em;
  font-family: sans-serif;
}
</style>
