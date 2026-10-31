<template>
  <BaseModal :model-value="open" labelledby="auth-prompt-title" narrow @update:model-value="emit('close')">
    <div class="auth-prompt">
      <v-icon size="32" color="primary" class="auth-prompt__icon">mdi-account-circle-outline</v-icon>
      <p id="auth-prompt-title" class="auth-prompt__message">{{ message }}</p>
      <v-btn color="primary" size="large" block class="auth-prompt__btn" @click="emit('login')">Войти</v-btn>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
/** A short "this needs an account" notice — just the reason and a "Войти" button, which hands
 * over to the regular AuthModal. For features a guest bumps into mid-task (e.g. regenerating an AI
 * text), where the full sign-in form popping up uninvited would be too much. */
import BaseModal from '@/components/ui/BaseModal.vue'

defineProps<{
  open: boolean
  message: string
}>()

const emit = defineEmits<{
  login: []
  close: []
}>()
</script>

<style scoped lang="scss">
.auth-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-4;
  text-align: center;
}

.auth-prompt__message {
  margin: 0;
  font-size: $font-size-body;
  line-height: 1.5;
}

.auth-prompt__btn {
  text-transform: none;
  letter-spacing: 0.02em;
}
</style>
