<template>
  <p>Hello I am B</p>
</template>

<script setup lang="ts">
import { useHead } from '@vueuse/head'

useHead(() => ({
  title: 'Hello'
}))
</script>
