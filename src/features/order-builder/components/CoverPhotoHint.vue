<template>
  <p class="cover-photo-hint" :class="{ 'cover-photo-hint--warn': landscape }">
    <span>{{ landscape ? landscapeText : shortText }}</span>
    <v-tooltip location="top" max-width="320" content-class="editor-tooltip--arrow-top">
      <template #activator="{ props: tooltipProps }">
        <button
          type="button"
          class="cover-photo-hint__info"
          aria-label="Подсказка по фото обложки"
          v-bind="tooltipProps"
        >
          <v-icon size="16">mdi-information-outline</v-icon>
        </button>
      </template>
      {{ fullText }}
    </v-tooltip>
  </p>
</template>

<script setup lang="ts">
defineProps<{
  landscape?: boolean
}>()

const shortText = 'Для обложки лучше вертикальное фото со спокойным фоном.'
const landscapeText = 'Горизонтальное фото: на обложке кадр сильно обрежется.'
const fullText =
  'Выберите вертикальное фото в хорошем качестве. Лучше всего подойдёт снимок со спокойным фоном и без большого количества мелких деталей — так текст и оформление обложки будут выглядеть аккуратно и хорошо читаться.'
</script>

<style scoped lang="scss">
.cover-photo-hint {
  display: flex;
  align-items: flex-start;
  gap: $spacing-2;
  margin: $spacing-3 0 0;
  font-size: $font-size-caption;
  line-height: 1.45;
  color: $text-secondary;

  &--warn {
    color: $text-primary;
  }
}

.cover-photo-hint__info {
  display: inline-flex;
  flex-shrink: 0;
  margin-top: 1px;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
}
</style>
