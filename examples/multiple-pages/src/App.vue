<script setup lang="ts">
const envMode = import.meta.env.VITE_ENV_MODE
</script>

<template>
  <main>
    <router-view />
    <pre>VITE_ENV_MODE:{{ envMode }}</pre>
  </main>
</template>

<style scoped>
main {
  padding: 4em 10em;
}
</style>
