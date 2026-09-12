<template>
  <BaseModal v-model="open" :labelledby="titleId">
    <div class="confirm-modal">
      <div class="confirm-modal__icon" :class="`confirm-modal__icon--${confirmColor}`" aria-hidden="true">
        <v-icon size="28" :color="confirmColor">{{ icon }}</v-icon>
      </div>

      <h2 :id="titleId" class="confirm-modal__title">{{ title }}</h2>
      <p class="confirm-modal__text">{{ message }}</p>

      <div class="confirm-modal__actions">
        <v-btn
          variant="outlined"
          color="secondary"
          class="confirm-modal__cancel"
          :disabled="loading"
          @click="cancel"
        >
          {{ cancelLabel }}
        </v-btn>
        <v-btn
          :color="confirmColor"
          variant="flat"
          class="confirm-modal__confirm"
          :loading="loading"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </v-btn>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

import BaseModal from './BaseModal.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    /** Vuetify color name for the icon/confirm button. Defaults to 'primary' — this app's theme
     * maps it to the pink accent, matching every other emphasis/destructive control in the UI
     * (the theme's actual 'error'/'warning' colors are muted brown tones, not red/amber, so they
     * read as a mistake here rather than a warning). */
    confirmColor?: string
    icon?: string
    loading?: boolean
  }>(),
  {
    confirmLabel: 'Удалить',
    cancelLabel: 'Отмена',
    confirmColor: 'primary',
    icon: 'mdi-trash-can-outline',
    loading: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()

const titleId = useId()

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

function cancel(): void {
  open.value = false
}
</script>

<style scoped lang="scss">
.confirm-modal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-3;
  width: min(100%, 420px);
  margin-inline: auto;
  padding-top: $spacing-2;
  text-align: center;
}

.confirm-modal__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 9999px;

  &--error {
    background: rgba(var(--v-theme-error), 0.1);
  }

  &--primary {
    background: $accent-tint;
  }
}

.confirm-modal__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.confirm-modal__text {
  margin: 0;
  font-size: $font-size-body-sm;
  line-height: 1.5;
  color: $text-secondary;
}

.confirm-modal__actions {
  display: flex;
  gap: $spacing-3;
  margin-top: $spacing-2;
  width: 100%;
}

.confirm-modal__cancel,
.confirm-modal__confirm {
  flex: 1;
  text-transform: none;
}
</style>
