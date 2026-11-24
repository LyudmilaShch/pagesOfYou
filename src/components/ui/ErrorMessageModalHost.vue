<template>
  <ErrorMessageModal
    v-model="isOpen"
    :title="title"
    :message="message"
    :facts="facts"
  />
</template>

<script setup lang="ts">
import ErrorMessageModal from '@/components/ui/ErrorMessageModal.vue'
import { useErrorMessageModal } from '@/shared/composables/useErrorMessageModal'

const { isOpen, title, message, facts } = useErrorMessageModal()
</script>
