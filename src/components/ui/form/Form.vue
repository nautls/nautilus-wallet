<script setup lang="ts">
const emit = defineEmits(["submit"]);
</script>

<template>
   <form @submit.prevent>
      <slot></slot>
      <input type="submit" class="hidden" @click="emit('submit')" />
   </form>
</template>