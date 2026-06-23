import { onUnmounted, ref, watch } from 'vue'

export interface MagazineData {
  recipient: string
  occasion: string
}

const defaultMagazineData: MagazineData = {
  recipient: 'Для Анны',
  occasion: 'День рождения 2025',
}

export const useMagazineModal = () => {
  const isOpen = ref(false)
  const magazine = ref<MagazineData>({ ...defaultMagazineData })

  const open = (data?: Partial<MagazineData>) => {
    magazine.value = { ...defaultMagazineData, ...data }
    isOpen.value = true
  }

  const close = () => {
    isOpen.value = false
  }

  watch(isOpen, (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
  })

  onUnmounted(() => {
    document.body.style.overflow = ''
  })

  return {
    isOpen,
    magazine,
    open,
    close,
  }
}
