const loadedScripts = new Map<string, Promise<void>>()

/** Loads an external `<script>` once and caches the in-flight/completed promise — calling this
 * again with the same URL (e.g. a component remounting) reuses the same load instead of
 * injecting a duplicate tag. */
export function loadScript(src: string): Promise<void> {
  const cached = loadedScripts.get(src)
  if (cached) {
    return cached
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })

  loadedScripts.set(src, promise)
  return promise
}
