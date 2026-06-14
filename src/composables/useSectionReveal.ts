import { onMounted, onUnmounted, ref, type Ref } from 'vue'

export function useSectionReveal(sectionRef: Ref<HTMLElement | null>) {
  const isRevealed = ref(false)
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (!sectionRef.value) return

    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          isRevealed.value = true
          observer?.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )

    observer.observe(sectionRef.value)
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  return { isRevealed }
}
