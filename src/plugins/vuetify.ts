import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import { theme } from '@/styles/theme'

export const vuetify = createVuetify({
  components,
  directives,
  theme,
  defaults: {
    VBtn: {
      rounded: 'lg',
      elevation: 0,
    },
    VCard: {
      rounded: 'lg',
      elevation: 0,
    },
    VSheet: {
      rounded: 'lg',
      elevation: 0,
    },
  },
})
