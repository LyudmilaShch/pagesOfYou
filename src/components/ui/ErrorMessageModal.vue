<template>
  <BaseModal v-model="open" narrow :labelledby="titleId">
    <div class="error-message-modal">
      <div class="error-message-modal__icon" aria-hidden="true">
        <v-icon size="22" color="error">mdi-alert-circle-outline</v-icon>
      </div>

      <h2 :id="titleId" class="error-message-modal__title">
        {{ title }}
      </h2>

      <p class="error-message-modal__text">
        {{ message }}
      </p>

      <div v-if="facts?.length" class="error-message-modal__facts">
        <div
          v-for="fact in facts"
          :key="fact.label"
          class="error-message-modal__fact"
          :class="{ 'error-message-modal__fact--target': fact.tone === 'target' }"
        >
          <span class="error-message-modal__fact-label">{{ fact.label }}</span>
          <span class="error-message-modal__fact-value">{{ fact.value }}</span>
        </div>
      </div>

      <v-btn
        color="primary"
        variant="flat"
        class="error-message-modal__action"
        @click="close"
      >
        Понятно
      </v-btn>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

import BaseModal from '@/components/ui/BaseModal.vue'
import type { ErrorMessageFact } from '@/shared/composables/useErrorMessageModal'

const props = defineProps<{
  modelValue: boolean
  title?: string
  message: string
  facts?: ErrorMessageFact[] | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const titleId = useId()

const title = computed(() => props.title ?? 'Ошибка')

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

function close(): void {
  open.value = false
}
</script>

<style scoped lang="scss">
.error-message-modal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-2;
  width: 100%;
  margin-inline: auto;
  padding-top: 0;
  text-align: center;
}

.error-message-modal__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 9999px;
  background: rgba(var(--v-theme-error), 0.1);
}

.error-message-modal__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.error-message-modal__text {
  margin: 0;
  font-size: $font-size-body-sm;
  line-height: 1.5;
  color: $text-secondary;
  white-space: pre-line;
}

.error-message-modal__facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-2;
  width: 100%;
  margin-top: $spacing-2;
}

.error-message-modal__fact {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
  min-width: 0;
  padding: $spacing-3;
  border-radius: $radius-md;
  background: $bg-muted;
  text-align: left;
}

.error-message-modal__fact--target {
  background: $accent-tint;
}

.error-message-modal__fact-label {
  font-size: $font-size-caption;
  line-height: 1.3;
  color: $text-secondary;
}

.error-message-modal__fact-value {
  margin-top: auto;
  font-size: $font-size-body;
  font-weight: $font-weight-semibold;
  line-height: 1.3;
  color: $text-primary;
}

.error-message-modal__action {
  align-self: flex-end;
  margin-top: $spacing-2;
  min-width: 140px;
}
</style>
