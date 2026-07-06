import VueKonva from 'vue-konva'
import type { App } from 'vue'

export function registerVueKonva(app: App): void {
  app.use(VueKonva)
}
