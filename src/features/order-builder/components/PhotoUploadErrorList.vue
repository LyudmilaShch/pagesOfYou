<template>
  <ul v-if="messages.length" class="photo-upload-errors" role="alert">
    <li v-for="(message, index) in messages" :key="`${index}-${message}`">{{ message }}</li>
  </ul>
</template>

<script setup lang="ts">
defineProps<{
  messages: string[]
}>()
</script>

<style scoped lang="scss">
.photo-upload-errors {
  width: 100%;
  margin: $spacing-2 0 0;
  padding: 0;
  list-style: none;
  color: #c62828;
  font-size: $font-size-caption;
  line-height: 1.4;
  text-align: left;

  li + li {
    margin-top: 4px;
  }
}
</style>
