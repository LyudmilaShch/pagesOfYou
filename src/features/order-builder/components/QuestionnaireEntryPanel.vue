<template>
  <aside class="questionnaire-entry" aria-label="Анкета">
    <div class="questionnaire-entry__header">
      <p class="questionnaire-entry__eyebrow">Анкета</p>
      <h2 class="questionnaire-entry__title">Быстрое заполнение</h2>
    </div>

    <p class="questionnaire-entry__hint">
      Ответьте на несколько простых вопросов — журнал заполнится сам, без ручного редактирования
      каждого элемента.
    </p>

    <v-btn block color="primary" prepend-icon="mdi-clipboard-text-outline" @click="goToQuestionnaire">
      Заполнить анкету
    </v-btn>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const orderId = computed(() => route.params.orderId as string)

function goToQuestionnaire(): void {
  void router.push({ name: 'order-questionnaire', params: { orderId: orderId.value } })
}
</script>

<style scoped lang="scss">
.questionnaire-entry {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding: $spacing-4;
}

.questionnaire-entry__eyebrow {
  margin: 0 0 $spacing-1;
  font-size: $font-size-caption;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: $text-muted;
}

.questionnaire-entry__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-h4;
}

.questionnaire-entry__hint {
  margin: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
}
</style>
