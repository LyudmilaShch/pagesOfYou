/** Reads an image file's natural pixel dimensions before upload — used so the backend can store
 * width/height on the gallery record without needing server-side image processing. */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to read image dimensions'))
    }

    image.src = url
  })
}
