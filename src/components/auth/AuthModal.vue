<template>
  <BaseModal
    :model-value="open"
    labelledby="auth-modal-title"
    @update:model-value="emit('close')"
  >
    <div class="auth-modal">
      <p v-if="message" id="auth-modal-title" class="auth-modal__message">{{ message }}</p>
      <AuthForm @success="emit('success')" />
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from '@/components/ui/BaseModal.vue'
import AuthForm from './AuthForm.vue'

defineProps<{
  open: boolean
  /** Context line shown above the form, e.g. "Чтобы оформить заказ, войдите в аккаунт". */
  message?: string
}>()

const emit = defineEmits<{
  success: []
  close: []
}>()
</script>

<style scoped lang="scss">
.auth-modal {
  width: 100%;
  max-width: 440px;
  margin: 0 auto;
}

.auth-modal__message {
  margin: 0 0 $spacing-4;
  font-size: $font-size-body-sm;
  color: $text-secondary;
  text-align: center;
}
</style>
