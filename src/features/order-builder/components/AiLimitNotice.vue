<template>
  <v-alert type="warning" variant="tonal" rounded="lg" density="comfortable" class="ai-limit-notice">
    <div class="ai-limit-notice__title">Сегодня ИИ уже не может писать новые тексты</div>
    <p class="ai-limit-notice__text">
      Ответы сохраняются.
      <template v-if="unwrittenCount > 0">Не созданы тексты: {{ unwrittenCount }}.</template>
      Недостающие тексты можно написать вручную на шаге «Проверка» или создать завтра — они
      допишутся сами, когда вы вернётесь к журналу.
      <template v-if="isGuest"> Войдите, чтобы получить больше генераций.</template>
    </p>
    <div v-if="isGuest" class="ai-limit-notice__actions">
      <v-btn variant="text" size="small" @click="emit('login')">Войти</v-btn>
    </div>
  </v-alert>
</template>

<script setup lang="ts">
/** Shown in the questionnaire and on the review step once the hidden daily cap on first AI texts
 * is reached (see the backend's AiUsageService) — rare, but auto-generation then stops quietly,
 * so without this the customer would just be left looking at placeholder text. Worded without
 * pointing at the book, which the questionnaire doesn't show on mobile. */
defineProps<{
  isGuest: boolean
  /** AI text parts left empty by the cap (see buildAiTextMarkers). */
  unwrittenCount: number
}>()

const emit = defineEmits<{
  login: []
}>()
</script>

<style scoped lang="scss">
.ai-limit-notice__title {
  font-weight: 600;
}

.ai-limit-notice__text {
  margin: $spacing-1 0 0;
  font-size: $font-size-body-sm;
}

.ai-limit-notice__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: $spacing-2;
}
</style>
