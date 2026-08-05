<template>
  <div class="panel-screen-header">
    <v-btn icon size="x-small" variant="text" aria-label="Назад" @click="emit('back')">
      <v-icon size="18">mdi-arrow-left</v-icon>
    </v-btn>
    <p class="panel-screen-header__title">{{ title }}</p>
    <span class="panel-screen-header__spacer" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()
const emit = defineEmits<{ back: [] }>()
</script>

<style scoped lang="scss">
.panel-screen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-2;
  padding: $spacing-4 $spacing-4;
  border-bottom: 1px solid $border-light;
}

.panel-screen-header__title {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: $font-size-body-lg;
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.panel-screen-header__spacer {
  width: 32px;
  height: 1px;
}
</style>
