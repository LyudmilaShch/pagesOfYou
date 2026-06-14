const HEADER_OFFSET = 72

export function getScrollContainer(): Window {
  return window
}

export function scrollToSection(hash: string, behavior: ScrollBehavior = 'smooth'): void {
  const id = hash.replace('#', '')

  const attemptScroll = (attemptsLeft: number) => {
    const target = document.getElementById(id)

    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET
      window.scrollTo({ top: Math.max(top, 0), behavior })
      return
    }

    if (attemptsLeft > 0) {
      requestAnimationFrame(() => attemptScroll(attemptsLeft - 1))
    }
  }

  attemptScroll(30)
}

export function scrollToTop(behavior: ScrollBehavior = 'auto'): void {
  window.scrollTo({ top: 0, behavior })
}

export function waitForSection(hash: string, maxAttempts = 30): Promise<boolean> {
  const id = hash.replace('#', '')

  return new Promise((resolve) => {
    const attempt = (remaining: number) => {
      if (document.getElementById(id)) {
        resolve(true)
        return
      }

      if (remaining <= 0) {
        resolve(false)
        return
      }

      requestAnimationFrame(() => attempt(remaining - 1))
    }

    attempt(maxAttempts)
  })
}
