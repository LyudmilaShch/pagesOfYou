import { ref } from 'vue'

import type { MeasureTextHeight } from './list-distribution.util'
import { measureKonvaText } from './text-measure.util'

/** Bumped whenever the browser finishes loading fonts. Read inside every measurement, so a Vue
 * computed that lays out a text-height list (materializeCanvasData under a thumbnail, the print
 * page, the editor's preview) re-runs once a template's web font arrives — instead of keeping the
 * heights measured with the fallback font. */
const fontsLoadedEpoch = ref(0)
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.addEventListener('loadingdone', () => {
    fontsLoadedEpoch.value += 1
  })
}

/** The editor's own text measurement (the same Konva layout the canvas and print use), for lists
 * laid out by real text height — see list-distribution.util.ts's flowColumn. */
export const measureListTextHeight: MeasureTextHeight = (text, content, fontSize) => {
  void fontsLoadedEpoch.value
  const shown = text.textTransform === 'uppercase' ? content.toUpperCase() : content
  return measureKonvaText({ text: shown, element: { ...text, fontSize }, maxWidth: text.size.width }).textHeight
}
