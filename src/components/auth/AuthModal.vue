<template>
  <BaseModal
    :model-value="open"
    labelledby="auth-modal-title"
    bare
    @update:model-value="emit('close')"
  >
    <div class="auth-modal">
      <AuthForm :message="message" title-id="auth-modal-title" @success="emit('success')" />
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from '@/components/ui/BaseModal.vue'
import AuthForm from './AuthForm.vue'

defineProps<{
  open: boolean
  /** Why sign-in is asked for, e.g. "Чтобы оформить заказ, войдите в аккаунт" — shown inside the
   * form card, right under its title (the modal has no panel of its own to put it on). */
  message?: string
}>()

const emit = defineEmits<{
  success: []
  close: []
}>()
</script>

<style scoped lang="scss">
.auth-modal :deep(.auth-card) {
  box-shadow: $shadow-lg;
}
</style>
