import { onBeforeUnmount, ref, type Ref } from 'vue'

// 767px mirrors $breakpoint-mobile-max in src/styles/breakpoints.scss — kept in sync manually
// since the project has no pipeline for sharing SCSS breakpoint values with JS.
const MOBILE_QUERY = '(max-width: 767px)'

export function useMobileViewport(): Ref<boolean> {
  const query = window.matchMedia(MOBILE_QUERY)
  const isMobile = ref(query.matches)

  function onChange(event: MediaQueryListEvent): void {
    isMobile.value = event.matches
  }

  query.addEventListener('change', onChange)

  onBeforeUnmount(() => {
    query.removeEventListener('change', onChange)
  })

  return isMobile
}
