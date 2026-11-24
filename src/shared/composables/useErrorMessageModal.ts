import { ref } from 'vue'

export interface ErrorMessageFact {
  label: string
  value: string
  /** The recommended figure, drawn apart from the current one. */
  tone?: 'current' | 'target'
}

const isOpen = ref(false)
const title = ref('Ошибка')
const message = ref('')
const facts = ref<ErrorMessageFact[] | null>(null)

export function useErrorMessageModal() {
  function showErrorMessageModal(
    text: string,
    modalTitle = 'Ошибка',
    nextFacts: ErrorMessageFact[] | null = null,
  ): void {
    message.value = text
    title.value = modalTitle
    facts.value = nextFacts
    isOpen.value = true
  }

  function closeErrorMessageModal(): void {
    isOpen.value = false
  }

  return {
    isOpen,
    title,
    message,
    facts,
    showErrorMessageModal,
    closeErrorMessageModal,
  }
}
