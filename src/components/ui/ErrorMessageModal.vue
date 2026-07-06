<template>
  <BaseModal v-model="open" :labelledby="titleId">
    <div class="error-message-modal">
      <div class="error-message-modal__icon" aria-hidden="true">
        <v-icon size="28" color="error">mdi-alert-circle-outline</v-icon>
      </div>

      <h2 :id="titleId" class="error-message-modal__title">
        {{ title }}
      </h2>

      <p class="error-message-modal__text">
        {{ message }}
      </p>

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

const props = defineProps<{
  modelValue: boolean
  title?: string
  message: string
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
  gap: $spacing-3;
  width: min(100%, 420px);
  margin-inline: auto;
  padding-top: $spacing-2;
  text-align: center;
}

.error-message-modal__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
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
}

.error-message-modal__action {
  margin-top: $spacing-2;
  min-width: 140px;
}
</style>
