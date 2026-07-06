export function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)

    image.onerror = () => {
      const fallback = new Image()
      fallback.onload = () => resolve(fallback)
      fallback.onerror = () => reject(new Error(`Failed to load image: ${url}`))
      fallback.src = url
    }

    image.crossOrigin = 'anonymous'
    image.src = url
  })
}
