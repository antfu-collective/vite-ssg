<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ init?: number }>()

const counter = ref(props.init || 0)
</script>

<template>
  <div class="counter">
    <div>Counter: {{ counter }}</div>
    <button @click="counter += 1">
      Inc
    </button>
    <button @click="counter -= 1">
      Dec
    </button>
  </div>
</template>

<style scoped>
.counter {
  border: 2px dashed #3eaf7c;
  padding: 5px 10px 10px 10px;
}
</style>
