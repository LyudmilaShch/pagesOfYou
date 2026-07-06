import { ref } from 'vue'

const isOpen = ref(false)
const title = ref('Ошибка')
const message = ref('')

export function useErrorMessageModal() {
  function showErrorMessageModal(
    text: string,
    modalTitle = 'Ошибка',
  ): void {
    message.value = text
    title.value = modalTitle
    isOpen.value = true
  }

  function closeErrorMessageModal(): void {
    isOpen.value = false
  }

  return {
    isOpen,
    title,
    message,
    showErrorMessageModal,
    closeErrorMessageModal,
  }
}
