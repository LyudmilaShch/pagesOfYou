import { ref, watch } from 'vue'

const FLIP_HINT_STORAGE_KEY = 'magazine-flip-hint-dismissed'

export const useFlipHint = (isModalOpen: () => boolean) => {
  const isHintVisible = ref(false)

  const dismissHint = () => {
    isHintVisible.value = false
    sessionStorage.setItem(FLIP_HINT_STORAGE_KEY, '1')
  }

  watch(isModalOpen, (open) => {
    if (!open) return

    isHintVisible.value = sessionStorage.getItem(FLIP_HINT_STORAGE_KEY) !== '1'
  })

  return {
    isHintVisible,
    dismissHint,
  }
}
