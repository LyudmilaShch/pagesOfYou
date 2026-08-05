export function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    // Required for Konva.Image filters (brightness/contrast/HSL/blur/etc.) — they read pixel
    // data via getImageData(), which throws on a canvas tainted by a cross-origin image loaded
    // without CORS. Relies on the storage bucket sending Access-Control-Allow-Origin.
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    image.src = url
  })
}
