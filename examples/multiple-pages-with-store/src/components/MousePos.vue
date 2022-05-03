<script setup lang="ts">
import { ref } from 'vue'

const x = ref(0)
const y = ref(0)

window.addEventListener('mousemove', (e) => {
  x.value = e.x
  y.value = e.y
})
</script>

<template>
  <div>{{ x }} x {{ y }}</div>
</template>
