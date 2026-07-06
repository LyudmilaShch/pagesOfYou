<template>

  <aside class="editor-properties" aria-label="Свойства элемента">

    <div class="editor-properties__header">

      <p class="editor-properties__eyebrow">Свойства</p>

      <h2 class="editor-properties__title">

        {{ panelTitle }}

      </h2>

    </div>



    <div class="editor-properties__body">

      <div v-if="!selected && !store.isMultiSelection" class="editor-properties__section">

        <p class="editor-properties__section-title">Страница</p>

        <p v-if="store.isSpreadPage" class="editor-properties__spread-note">
          Разворот из двух страниц A4. Координаты X, направляющие и выравнивание считаются отдельно для
          левой и правой страницы (0…595 pt на каждой).
        </p>



        <v-select

          :model-value="pagePreset"

          :items="pagePresetItems"

          item-title="label"

          item-value="key"

          label="Размер страницы"

          variant="outlined"

          density="compact"

          hide-details

          :disabled="store.isSpreadPage"

          @update:model-value="applyPagePreset"

        />



        <div class="editor-properties__grid">

          <v-text-field

            :model-value="store.pageWidth"

            label="Ширина"

            type="number"

            variant="outlined"

            density="compact"

            hide-details

            :disabled="store.isSpreadPage"

            @update:model-value="updatePageSize('width', $event)"

          />

          <v-text-field

            :model-value="store.pageHeight"

            label="Высота"

            type="number"

            variant="outlined"

            density="compact"

            hide-details

            :disabled="store.isSpreadPage"

            @update:model-value="updatePageSize('height', $event)"

          />

        </div>



        <EditorColorPicker
          :model-value="store.backgroundColor"
          label="Цвет фона"
          fallback="#FFFFFF"
          @update:model-value="updateBackgroundColor"
        />

      </div>



      <template v-if="store.isMultiSelection">
        <div class="editor-properties__section">
          <p class="editor-properties__section-title">Множественное выделение</p>
          <p class="editor-properties__meta">
            Выделено: {{ store.selectionCount }}
            <span v-if="store.alignableSelectedElements.length !== store.selectionCount">
              ({{ store.alignableSelectedElements.length }} доступно для выравнивания)
            </span>
          </p>
          <p class="editor-properties__hint-inline">
            Shift+клик или рамка на холсте для выбора нескольких элементов
          </p>

          <p class="editor-properties__section-title editor-properties__section-title--nested">
            Выравнивание
          </p>
          <div class="editor-properties__align-row">
            <v-btn
              icon
              size="small"
              variant="outlined"
              title="По левому краю"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
              @click="alignMulti('left')"
            >
              <v-icon size="18">mdi-format-horizontal-align-left</v-icon>
            </v-btn>
            <v-btn
              icon
              size="small"
              variant="outlined"
              title="По верхнему краю"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
              @click="alignMulti('top')"
            >
              <v-icon size="18">mdi-format-vertical-align-top</v-icon>
            </v-btn>
            <v-btn
              icon
              size="small"
              variant="outlined"
              title="По центру по горизонтали"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
              @click="alignMulti('center-horizontal')"
            >
              <v-icon size="18">mdi-format-horizontal-align-center</v-icon>
            </v-btn>
            <v-btn
              icon
              size="small"
              variant="outlined"
              title="По центру по вертикали"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
              @click="alignMulti('center-vertical')"
            >
              <v-icon size="18">mdi-format-vertical-align-center</v-icon>
            </v-btn>
          </div>

          <div class="editor-properties__align-row">
            <v-btn
              icon
              size="small"
              variant="outlined"
              title="Распределить по горизонтали (3+)"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 3"
              @click="alignMulti('distribute-horizontal')"
            >
              <v-icon size="18">mdi-distribute-horizontal-center</v-icon>
            </v-btn>
            <v-btn
              icon
              size="small"
              variant="outlined"
              title="Распределить по вертикали (3+)"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 3"
              @click="alignMulti('distribute-vertical')"
            >
              <v-icon size="18">mdi-distribute-vertical-center</v-icon>
            </v-btn>
          </div>

          <p class="editor-properties__section-title editor-properties__section-title--nested">
            Отступы между элементами
          </p>
          <p class="editor-properties__hint-inline">
            Между соседними элементами на холсте. Измените значение — отступ применится от якорного
            элемента.
          </p>
          <div class="editor-properties__grid">
            <v-text-field
              :model-value="horizontalGapDraft"
              label="Горизонтально"
              type="number"
              suffix="px"
              variant="outlined"
              density="compact"
              hide-details
              :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
              @focus="horizontalGapFocused = true"
              @blur="onHorizontalGapBlur"
              @keyup.enter="onHorizontalGapBlur"
              @update:model-value="onHorizontalGapChange"
            />
            <v-text-field
              :model-value="verticalGapDraft"
              label="Вертикально"
              type="number"
              suffix="px"
              variant="outlined"
              density="compact"
              hide-details
              :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
              @focus="verticalGapFocused = true"
              @blur="onVerticalGapBlur"
              @keyup.enter="onVerticalGapBlur"
              @update:model-value="onVerticalGapChange"
            />
          </div>
        </div>
      </template>



      <template v-else-if="selected">

        <div class="editor-properties__section">

          <p class="editor-properties__section-title">Позиция и размер</p>

          <div class="editor-properties__grid">

            <v-text-field

              :model-value="displayPositionX"

              :label="positionXLabel"

              type="number"

              variant="outlined"

              density="compact"

              hide-details

              @update:model-value="updatePosition('x', $event)"

            />

            <v-text-field

              :model-value="selected.position.y"

              label="Y"

              type="number"

              variant="outlined"

              density="compact"

              hide-details

              @update:model-value="updatePosition('y', $event)"

            />

            <v-text-field

              :model-value="selected.size.width"

              label="Ширина"

              type="number"

              variant="outlined"

              density="compact"

              hide-details

              @update:model-value="updateSize('width', $event)"

            />

            <v-text-field

              :model-value="selected.size.height"

              label="Высота"

              type="number"

              variant="outlined"

              density="compact"

              hide-details

              @update:model-value="updateSize('height', $event)"

            />

            <v-text-field
              v-if="!isTextElement"

              :model-value="displayRotation"

              label="Угол"

              type="number"

              suffix="°"

              step="1"

              variant="outlined"

              density="compact"

              hide-details

              prepend-inner-icon="mdi-rotate-right"

              :disabled="store.previewMode || selected.locked"

              @update:model-value="updateRotation($event)"

            />

          </div>

          <div class="editor-properties__section">
            <p class="editor-properties__section-title">Выравнивание</p>
            <div class="editor-properties__align-row">
              <v-btn
                icon
                size="small"
                variant="outlined"
                title="По центру по горизонтали"
                :disabled="store.previewMode || selected.locked"
                @click="alignToPageCenter('horizontal')"
              >
                <v-icon size="18">mdi-format-horizontal-align-center</v-icon>
              </v-btn>
              <v-btn
                icon
                size="small"
                variant="outlined"
                title="По центру по вертикали"
                :disabled="store.previewMode || selected.locked"
                @click="alignToPageCenter('vertical')"
              >
                <v-icon size="18">mdi-format-vertical-align-center</v-icon>
              </v-btn>
              <v-btn
                icon
                size="small"
                variant="outlined"
                title="По центру страницы"
                :disabled="store.previewMode || selected.locked"
                @click="alignToPageCenter('both')"
              >
                <v-icon size="18">mdi-target</v-icon>
              </v-btn>
            </div>
          </div>
        </div>



        <div v-if="isTextElement" class="editor-properties__section">

          <p class="editor-properties__section-title">Текст по умолчанию</p>



          <v-text-field

            :model-value="textElement.label"

            label="Название поля"

            variant="outlined"

            density="compact"

            hide-details

            @update:model-value="patchElement({ label: String($event ?? '') })"

          />



          <v-textarea

            :model-value="textElement.defaultText ?? ''"

            label="Текст для пользователя"

            variant="outlined"

            density="compact"

            rows="2"

            auto-grow

            hide-details

            hint="Пользователь увидит этот текст и сможет заменить на свой"

            persistent-hint

            @update:model-value="patchElement({ defaultText: String($event ?? '') })"

          />



          <p class="editor-properties__section-title editor-properties__section-title--nested">Типографика</p>



          <v-select

            :model-value="textElement.fontFamily"

            :items="fontOptions"

            item-title="title"

            item-value="value"

            label="Шрифт"

            variant="outlined"

            density="compact"

            hide-details

            @update:model-value="patchElement({ fontFamily: String($event ?? '') })"

          />



          <v-text-field

            :model-value="textElement.fontSize"

            label="Размер"

            type="number"

            min="1"

            variant="outlined"

            density="compact"

            hide-details

            @update:model-value="patchElement({ fontSize: toNumber($event, textElement.fontSize) })"

          />



          <div class="editor-properties__typo-toolbar">

            <v-btn

              :variant="isTextBold ? 'flat' : 'outlined'"

              :color="isTextBold ? 'primary' : undefined"

              size="small"

              class="editor-properties__style-btn"

              title="Жирный"

              @click="toggleBold"

            >

              <span class="editor-properties__style-icon editor-properties__style-icon--bold">B</span>

            </v-btn>

            <v-btn

              :variant="isTextItalic ? 'flat' : 'outlined'"

              :color="isTextItalic ? 'primary' : undefined"

              size="small"

              class="editor-properties__style-btn"

              title="Курсив"

              @click="toggleItalic"

            >

              <span class="editor-properties__style-icon editor-properties__style-icon--italic">I</span>

            </v-btn>

            <v-btn

              :variant="isTextUppercase ? 'flat' : 'outlined'"

              :color="isTextUppercase ? 'primary' : undefined"

              size="small"

              class="editor-properties__style-btn"

              icon="mdi-format-letter-case-upper"

              title="Все заглавные"

              @click="toggleUppercase"

            />



            <span class="editor-properties__typo-divider" aria-hidden="true" />



            <v-btn

              :variant="textElement.textAlign === 'left' ? 'flat' : 'outlined'"

              :color="textElement.textAlign === 'left' ? 'primary' : undefined"

              size="small"

              class="editor-properties__style-btn"

              icon="mdi-format-align-left"

              title="Слева"

              @click="setTextAlign('left')"

            />

            <v-btn

              :variant="textElement.textAlign === 'center' ? 'flat' : 'outlined'"

              :color="textElement.textAlign === 'center' ? 'primary' : undefined"

              size="small"

              class="editor-properties__style-btn"

              icon="mdi-format-align-center"

              title="По центру"

              @click="setTextAlign('center')"

            />

            <v-btn

              :variant="textElement.textAlign === 'right' ? 'flat' : 'outlined'"

              :color="textElement.textAlign === 'right' ? 'primary' : undefined"

              size="small"

              class="editor-properties__style-btn"

              icon="mdi-format-align-right"

              title="Справа"

              @click="setTextAlign('right')"

            />



            <span class="editor-properties__typo-divider" aria-hidden="true" />



            <v-menu

              v-model="textSpacingMenuOpen"

              :close-on-content-click="false"

              location="bottom start"

              offset="8"

            >

              <template #activator="{ props: menuProps }">

                <v-btn

                  v-bind="menuProps"

                  :variant="textSpacingMenuOpen || hasAdvancedTextSpacing ? 'flat' : 'outlined'"

                  :color="textSpacingMenuOpen || hasAdvancedTextSpacing ? 'primary' : undefined"

                  size="small"

                  class="editor-properties__style-btn"

                  icon="mdi-format-line-spacing"

                  title="Интервалы и выравнивание"

                />

              </template>



              <v-card class="editor-properties__spacing-menu" min-width="280">

                <div class="editor-properties__spacing-row">

                  <span class="editor-properties__spacing-label">Межбуквенный интервал</span>

                  <div class="editor-properties__spacing-control">

                    <v-slider

                      :model-value="textElement.letterSpacing"

                      :min="LETTER_SPACING_MIN"

                      :max="LETTER_SPACING_MAX"

                      :step="0.1"

                      color="primary"

                      hide-details

                      @update:model-value="patchElement({ letterSpacing: Number($event) })"

                    />

                    <v-text-field

                      :model-value="textElement.letterSpacing"

                      type="number"

                      :min="LETTER_SPACING_MIN"

                      :max="LETTER_SPACING_MAX"

                      step="0.1"

                      density="compact"

                      variant="outlined"

                      hide-details

                      class="editor-properties__spacing-input"

                      @update:model-value="patchElement({ letterSpacing: toNumber($event, textElement.letterSpacing) })"

                    />

                  </div>

                </div>



                <div class="editor-properties__spacing-row">

                  <span class="editor-properties__spacing-label">Расстояние между строками</span>

                  <div class="editor-properties__spacing-control">

                    <v-slider

                      :model-value="textElement.lineHeight"

                      :min="LINE_HEIGHT_MIN"

                      :max="LINE_HEIGHT_MAX"

                      :step="0.05"

                      color="primary"

                      hide-details

                      @update:model-value="patchElement({ lineHeight: Number($event) })"

                    />

                    <v-text-field

                      :model-value="textElement.lineHeight"

                      type="number"

                      :min="LINE_HEIGHT_MIN"

                      :max="LINE_HEIGHT_MAX"

                      step="0.05"

                      density="compact"

                      variant="outlined"

                      hide-details

                      class="editor-properties__spacing-input"

                      @update:model-value="patchElement({ lineHeight: toNumber($event, textElement.lineHeight) })"

                    />

                  </div>

                </div>



                <div class="editor-properties__spacing-row editor-properties__spacing-row--align">

                  <span class="editor-properties__spacing-label">Закрепить поле</span>

                  <div class="editor-properties__spacing-align">

                    <v-btn

                      :variant="textElement.verticalAlign === 'bottom' ? 'flat' : 'text'"

                      :color="textElement.verticalAlign === 'bottom' ? 'primary' : undefined"

                      size="small"

                      class="editor-properties__spacing-align-btn"

                      icon="mdi-format-vertical-align-bottom"

                      title="Снизу"

                      @click="setVerticalAlign('bottom')"

                    />

                    <v-btn

                      :variant="textElement.verticalAlign === 'middle' ? 'flat' : 'text'"

                      :color="textElement.verticalAlign === 'middle' ? 'primary' : undefined"

                      size="small"

                      class="editor-properties__spacing-align-btn"

                      icon="mdi-format-vertical-align-center"

                      title="По центру"

                      @click="setVerticalAlign('middle')"

                    />

                    <v-btn

                      :variant="textElement.verticalAlign === 'top' ? 'flat' : 'text'"

                      :color="textElement.verticalAlign === 'top' ? 'primary' : undefined"

                      size="small"

                      class="editor-properties__spacing-align-btn"

                      icon="mdi-format-vertical-align-top"

                      title="Сверху"

                      @click="setVerticalAlign('top')"

                    />

                  </div>

                </div>

              </v-card>

            </v-menu>

          </div>



          <EditorColorPicker
            :model-value="textElement.color"
            label="Цвет текста"
            fallback="#111111"
            @update:model-value="patchElement({ color: $event })"
          />



          <v-switch

            :model-value="textElement.required"

            label="Обязательное поле"

            color="primary"

            hide-details

            @update:model-value="patchElement({ required: Boolean($event) })"

          />

        </div>



        <div v-if="isPhotoElement" class="editor-properties__section">

          <p class="editor-properties__section-title">Фото по умолчанию</p>



          <v-text-field

            :model-value="photoElement.label"

            label="Название поля"

            variant="outlined"

            density="compact"

            hide-details

            @update:model-value="patchElement({ label: String($event ?? '') })"

          />



          <div v-if="photoElement.defaultImageUrl" class="editor-properties__image-preview">

            <img :src="displayImageUrl" alt="Фото по умолчанию" />

            <v-btn size="small" variant="text" color="error" @click="patchElement({ defaultImageUrl: null, cropX: 0, cropY: 0, imageScale: 1 })">

              Удалить

            </v-btn>

          </div>



          <v-btn

            variant="outlined"

            size="small"

            prepend-icon="mdi-image-plus-outline"

            :loading="uploadingImage"

            @click="triggerImageInput"

          >

            {{ photoElement.defaultImageUrl ? 'Заменить фото' : 'Загрузить фото' }}

          </v-btn>

          <input ref="imageInputRef" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onImageSelected" />

          <v-btn
            v-if="photoElement.defaultImageUrl"
            variant="outlined"
            size="small"
            prepend-icon="mdi-crop"
            :disabled="store.previewMode"
            @click="handleStartPhotoCrop"
          >
            Кадрировать
          </v-btn>



          <v-select

            :model-value="photoElement.fitMode"

            :items="fitModeOptions"

            item-title="label"

            item-value="value"

            label="Масштабирование"

            variant="outlined"

            density="compact"

            hide-details

            @update:model-value="patchElement({ fitMode: $event as typeof photoElement.fitMode })"

          />



          <v-text-field

            :model-value="photoElement.borderRadius"

            label="Скругление углов"

            type="number"

            variant="outlined"

            density="compact"

            hide-details

            @update:model-value="patchElement({ borderRadius: toNumber($event, photoElement.borderRadius) })"

          />

          <EditorBorderFields
            :stroke="photoElement.stroke"
            :stroke-width="photoElement.strokeWidth"
            :stroke-style="photoElement.strokeStyle"
            :stroke-position="photoElement.strokePosition"
            @patch="patchElement"
          />



          <v-switch

            :model-value="photoElement.required"

            label="Обязательное поле"

            color="primary"

            hide-details

            @update:model-value="patchElement({ required: Boolean($event) })"

          />

        </div>



        <div v-if="isBackgroundElement" class="editor-properties__section">

          <p class="editor-properties__section-title">Фоновый блок</p>

          <EditorColorPicker
            :model-value="backgroundElement.color"
            label="Цвет"
            fallback="#FFFFFF"
            @update:model-value="patchElement({ color: $event })"
          />

        </div>



        <div v-if="isShapeElement" class="editor-properties__section">

          <p class="editor-properties__section-title">{{ isLineElement ? 'Линия' : 'Фигура' }}</p>

          <EditorShapeStrokeFields
            :element="shapeElement"
            :show-fill="!isLineElement"
            :optional-stroke="!isLineElement"
            :stroke-width-label="isLineElement ? 'Толщина' : 'Толщина'"
            @patch="(patch) => patchElement(patch as ElementPatch)"
          />

        </div>



        <div class="editor-properties__section">

          <p class="editor-properties__section-title">Элемент</p>

          <p class="editor-properties__meta">Тип: {{ selected.type }}</p>



          <v-btn
            variant="outlined"
            size="small"
            prepend-icon="mdi-content-copy"
            class="editor-properties__duplicate"
            :disabled="store.previewMode"
            @click="handleDuplicate"
          >
            Дублировать
          </v-btn>

          <v-btn
            variant="outlined"
            color="error"
            size="small"
            prepend-icon="mdi-delete-outline"
            class="editor-properties__delete"
            :disabled="store.previewMode"
            @click="handleRemove"
          >

            Удалить элемент

          </v-btn>

        </div>

      </template>



      <div v-else class="editor-properties__hint">

        <v-icon size="28" color="textMuted">mdi-cursor-default-outline</v-icon>

        <p>Выберите элемент на странице или настройте параметры страницы выше.</p>

      </div>

    </div>

  </aside>

</template>



<script setup lang="ts">

import { computed, ref, watch } from 'vue'

import { storeToRefs } from 'pinia'



import { uploadAdminImage } from '@/shared/api/admin/uploads.api'

import { resolveAssetUrl } from '@/shared/config/assets'
import { useErrorMessageModal } from '@/shared/composables/useErrorMessageModal'
import { getUploadErrorMessage } from '@/shared/utils/api-error.util'

import {

  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
  EDITOR_FONT_OPTIONS,

  PAGE_SIZE_PRESETS,

} from '../constants/page.constants'

import type { ElementPatch } from '../store/editor.store'

import { useEditorStore } from '../store/editor.store'
import EditorShapeStrokeFields from './EditorShapeStrokeFields.vue'
import EditorColorPicker from './EditorColorPicker.vue'
import EditorBorderFields from './EditorBorderFields.vue'

import type { MultiAlignMode } from '../utils/align-elements.util'
import {
  getAverageHorizontalGap,
  getAverageVerticalGap,
} from '../utils/align-elements.util'

import {
  isPhotoPlaceholderElement,

  isTextPlaceholderElement,

} from '../utils/placeholder-display.util'
import {
  getSpreadPageSide,
  getSpreadPageSideLabel,
  spreadGlobalXToPageLocal,
  spreadPageLocalXToGlobal,
} from '../utils/spread.util'
import { normalizeElementRotation } from '../utils/transformer.util'



const store = useEditorStore()
const { showErrorMessageModal } = useErrorMessageModal()

const { selectedElement: selected } = storeToRefs(store)

const selectedSpreadSide = computed(() => {
  if (!store.isSpreadPage || !selected.value) {
    return null
  }

  return getSpreadPageSide(
    selected.value.position.x,
    A4_SPREAD_PAGE_WIDTH,
    A4_SPREAD_PAGE_HEIGHT,
    selected.value.size.width,
  )
})

const displayPositionX = computed(() => {
  if (!selected.value) {
    return 0
  }

  if (!selectedSpreadSide.value) {
    return selected.value.position.x
  }

  return spreadGlobalXToPageLocal(selected.value.position.x, selectedSpreadSide.value)
})

const positionXLabel = computed(() =>
  selectedSpreadSide.value
    ? `X (${getSpreadPageSideLabel(selectedSpreadSide.value)})`
    : 'X',
)

const displayRotation = computed(() =>
  selected.value ? normalizeElementRotation(selected.value.rotation, 0) : 0,
)



const imageInputRef = ref<HTMLInputElement | null>(null)

const uploadingImage = ref(false)

const horizontalGapDraft = ref('')
const verticalGapDraft = ref('')
const horizontalGapFocused = ref(false)
const verticalGapFocused = ref(false)

const textSpacingMenuOpen = ref(false)

const LETTER_SPACING_MIN = -2
const LETTER_SPACING_MAX = 20
const LINE_HEIGHT_MIN = 0.5
const LINE_HEIGHT_MAX = 3



const fontOptions = EDITOR_FONT_OPTIONS

const fitModeOptions = [

  { label: 'Cover', value: 'cover' },

  { label: 'Fill', value: 'fill' },

]



const pagePresetItems = PAGE_SIZE_PRESETS.map((preset, index) => ({

  key: String(index),

  label: `${preset.label} (${preset.width}×${preset.height})`,

  width: preset.width,

  height: preset.height,

}))



const isTextElement = computed(() => selected.value && isTextPlaceholderElement(selected.value))

const isPhotoElement = computed(() => selected.value && isPhotoPlaceholderElement(selected.value))

const isBackgroundElement = computed(() => selected.value?.type === 'background')

const isShapeElement = computed(

  () =>

    selected.value?.type === 'shape-rectangle' ||

    selected.value?.type === 'shape-circle' ||

    selected.value?.type === 'shape-line',

)

const isLineElement = computed(() => selected.value?.type === 'shape-line')



const textElement = computed(() => selected.value as import('../models/text-placeholder.model').TextPlaceholder)

const isTextBold = computed(() => {
  if (!selected.value || !isTextPlaceholderElement(selected.value)) {
    return false
  }

  return selected.value.fontWeight >= 600
})

const isTextItalic = computed(() => {
  if (!selected.value || !isTextPlaceholderElement(selected.value)) {
    return false
  }

  return Boolean(selected.value.fontItalic)
})

const isTextUppercase = computed(() => {
  if (!selected.value || !isTextPlaceholderElement(selected.value)) {
    return false
  }

  return selected.value.textTransform === 'uppercase'
})

const hasAdvancedTextSpacing = computed(() => {
  if (!selected.value || !isTextPlaceholderElement(selected.value)) {
    return false
  }

  return selected.value.letterSpacing !== 0 || selected.value.verticalAlign !== 'top'
})

const photoElement = computed(() => selected.value as import('../models/photo-placeholder.model').PhotoPlaceholder)

const backgroundElement = computed(() => selected.value as import('../models/background-element.model').BackgroundElement)

const shapeElement = computed(() => selected.value as import('../models/shape-element.model').ShapeElement)



const displayImageUrl = computed(() =>

  resolveAssetUrl(photoElement.value?.defaultImageUrl ?? null) ?? undefined,

)



const pagePreset = computed(() => {

  const match = pagePresetItems.findIndex(

    (item) => item.width === store.pageWidth && item.height === store.pageHeight,

  )

  return match >= 0 ? String(match) : 'custom'

})

const panelTitle = computed(() => {
  if (store.isMultiSelection) {
    return `${store.selectionCount} элементов`
  }

  if (selected.value) {
    return selected.value.name
  }

  return 'Страница'
})



function toNumber(value: string | number | null | undefined, fallback: number): number {

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback

}



function patchElement(patch: ElementPatch): void {

  if (!selected.value) {

    return

  }



  store.updateElement(selected.value.id, patch)

}



function toggleBold(): void {
  patchElement({ fontWeight: isTextBold.value ? 400 : 700 })
}

function toggleItalic(): void {
  patchElement({ fontItalic: !isTextItalic.value })
}

function toggleUppercase(): void {
  patchElement({ textTransform: isTextUppercase.value ? 'none' : 'uppercase' })
}

function setTextAlign(value: import('../models/text-placeholder.model').TextAlign): void {
  patchElement({ textAlign: value })
}

function setVerticalAlign(
  value: import('../models/text-placeholder.model').TextVerticalAlign,
): void {
  patchElement({ verticalAlign: value })
}



function updatePosition(axis: 'x' | 'y', value: string | number | null | undefined): void {
  if (!selected.value) {
    return
  }

  if (axis === 'x' && selectedSpreadSide.value) {
    const raw = toNumber(value, displayPositionX.value)
    const next = store.snapToGridEnabled ? store.snapCoordinate(raw) : raw

    patchElement({
      position: {
        x: spreadPageLocalXToGlobal(next, selectedSpreadSide.value),
      },
    })
    return
  }

  const raw = toNumber(value, selected.value.position[axis])
  const next = store.snapToGridEnabled
    ? store.snapCoordinate(raw)
    : raw

  patchElement({
    position: {
      [axis]: next,
    },
  })
}

function alignToPageCenter(axis: 'horizontal' | 'vertical' | 'both'): void {
  if (!selected.value || store.previewMode || selected.value.locked) {
    return
  }

  store.alignSelectedToPageCenter(axis)
}

function alignMulti(mode: MultiAlignMode): void {
  if (store.previewMode) {
    return
  }

  store.alignSelectedElements(mode)
}

function syncGapDrafts(): void {
  if (!horizontalGapFocused.value) {
    const gap = getAverageHorizontalGap(store.alignableSelectedElements)
    horizontalGapDraft.value = gap !== null ? String(gap) : ''
  }

  if (!verticalGapFocused.value) {
    const gap = getAverageVerticalGap(store.alignableSelectedElements)
    verticalGapDraft.value = gap !== null ? String(gap) : ''
  }
}

function onHorizontalGapChange(value: string | number | null | undefined): void {
  if (value === null || value === undefined || value === '') {
    horizontalGapDraft.value = ''
    return
  }

  horizontalGapDraft.value = String(value)

  const gap = Number(value)
  if (!Number.isFinite(gap) || store.alignableSelectedElements.length < 2) {
    return
  }

  store.applyDistributionGap('horizontal', gap)
}

function onVerticalGapChange(value: string | number | null | undefined): void {
  if (value === null || value === undefined || value === '') {
    verticalGapDraft.value = ''
    return
  }

  verticalGapDraft.value = String(value)

  const gap = Number(value)
  if (!Number.isFinite(gap) || store.alignableSelectedElements.length < 2) {
    return
  }

  store.applyDistributionGap('vertical', gap)
}

function onHorizontalGapBlur(): void {
  horizontalGapFocused.value = false
  syncGapDrafts()
}

function onVerticalGapBlur(): void {
  verticalGapFocused.value = false
  syncGapDrafts()
}

watch(
  () => selected.value?.id,
  () => {
    textSpacingMenuOpen.value = false
  },
)

watch(
  () => [
    store.selectedElementIds.join(','),
    store.alignableSelectedElements
      .map(
        (element) =>
          `${element.id}:${element.position.x},${element.position.y},${element.size.width},${element.size.height}`,
      )
      .join('|'),
  ],
  () => {
    syncGapDrafts()
  },
  { immediate: true },
)



function updateSize(axis: 'width' | 'height', value: string | number | null | undefined): void {

  if (!selected.value) {

    return

  }



  patchElement({

    size: {

      [axis]: toNumber(value, selected.value.size[axis]),

    },

  })

}



function updateRotation(value: string | number | null | undefined): void {
  if (!selected.value || isTextPlaceholderElement(selected.value)) {
    return
  }

  patchElement({
    rotation: normalizeElementRotation(value, selected.value.rotation ?? 0),
  })
}



function updatePageSize(axis: 'width' | 'height', value: string | number | null | undefined): void {

  store.updatePageSettings({

    [axis]: toNumber(value, axis === 'width' ? store.pageWidth : store.pageHeight),

  })

}



function updateBackgroundColor(value: string | null | undefined): void {

  if (!value?.trim()) {

    return

  }



  store.updatePageSettings({ backgroundColor: value.trim() })

}



function applyPagePreset(key: string): void {

  const preset = pagePresetItems[Number(key)]

  if (!preset) {

    return

  }



  store.updatePageSettings({ width: preset.width, height: preset.height })

}



function triggerImageInput(): void {

  imageInputRef.value?.click()

}



async function onImageSelected(event: Event): Promise<void> {

  const input = event.target as HTMLInputElement

  const file = input.files?.[0]



  if (!file || !selected.value) {

    return

  }



  uploadingImage.value = true



  try {

    const { url } = await uploadAdminImage(file)

    patchElement({ defaultImageUrl: url, cropX: 0, cropY: 0, imageScale: 1 })

  } catch (error) {

    showErrorMessageModal(
      getUploadErrorMessage(error),
      'Не удалось загрузить фото',
    )

  } finally {

    uploadingImage.value = false

    input.value = ''

  }

}



function handleStartPhotoCrop(): void {
  if (!selected.value || store.previewMode || !isPhotoPlaceholderElement(selected.value)) {
    return
  }

  store.stopPhotoDim()
  store.startPhotoCropEditing(selected.value.id)
}

function handleDuplicate(): void {
  if (!selected.value || store.previewMode) {
    return
  }

  store.duplicateElement(selected.value.id)
}

function handleRemove(): void {

  if (!selected.value) {

    return

  }



  store.removeElement(selected.value.id)

}

</script>



<style scoped lang="scss">

.editor-properties {

  display: flex;

  flex-direction: column;

  height: 100%;

  border-left: 1px solid $border-light;

  background: $bg-primary;

}



.editor-properties__header {

  padding: $spacing-6 $spacing-4 $spacing-4;

  border-bottom: 1px solid $border-light;

}



.editor-properties__eyebrow {

  margin: 0 0 $spacing-1;

  font-size: $font-size-caption;

  letter-spacing: $letter-spacing-caption;

  text-transform: uppercase;

  color: $text-muted;

}



.editor-properties__title {

  margin: 0;

  font-family: $font-family-display;

  font-size: $font-size-h4;

  font-weight: $font-weight-regular;

  color: $text-primary;

}



.editor-properties__body {

  display: flex;

  flex-direction: column;

  gap: $spacing-4;

  padding: $spacing-4;

  overflow-y: auto;

}



.editor-properties__section {

  display: flex;

  flex-direction: column;

  gap: $spacing-3;

}



.editor-properties__section-title {

  margin: 0;

  font-size: $font-size-caption;

  letter-spacing: $letter-spacing-caption;

  text-transform: uppercase;

  color: $text-muted;

}

.editor-properties__spread-note {
  margin: 0 0 $spacing-3;
  font-size: $font-size-body-sm;
  line-height: 1.45;
  color: $text-secondary;
}



.editor-properties__grid {

  display: grid;

  grid-template-columns: repeat(2, minmax(0, 1fr));

  gap: $spacing-3;

}



.editor-properties__align-row {

  display: flex;

  gap: $spacing-2;

  flex-wrap: wrap;

}



.editor-properties__hint-inline {

  margin: 0 0 $spacing-3;

  font-size: $font-size-caption;

  color: $text-muted;

}



.editor-properties__section-title--nested {

  margin-top: $spacing-4;

}



.editor-properties__field-label {

  display: block;

  margin-bottom: $spacing-1;

  font-size: $font-size-caption;

  color: $text-muted;

}



.editor-properties__typo-toolbar {

  display: flex;

  flex-wrap: wrap;

  align-items: center;

  gap: $spacing-1;

}



.editor-properties__typo-divider {

  width: 1px;

  height: 24px;

  margin: 0 $spacing-1;

  background: $border-light;

  flex-shrink: 0;

}



.editor-properties__spacing-menu {

  padding: $spacing-4;

  border-radius: $radius-md;

  box-shadow: 0 8px 24px rgb(17 17 17 / 12%);

}



.editor-properties__spacing-row {

  display: flex;

  flex-direction: column;

  gap: $spacing-2;

  margin-bottom: $spacing-4;



  &:last-child {

    margin-bottom: 0;

  }



  &--align {

    padding-top: $spacing-3;

    border-top: 1px solid $border-light;

  }

}



.editor-properties__spacing-label {

  font-size: $font-size-body-sm;

  color: $text-primary;

}



.editor-properties__spacing-control {

  display: grid;

  grid-template-columns: 1fr 56px;

  gap: $spacing-2;

  align-items: center;

}



.editor-properties__spacing-input {

  :deep(.v-field) {

    font-size: $font-size-body-sm;

  }

}



.editor-properties__spacing-align {

  display: flex;

  gap: $spacing-1;

}



.editor-properties__spacing-align-btn {

  min-width: 36px;

  width: 36px;

  height: 36px;

}



.editor-properties__style-field {

  display: flex;

  flex-direction: column;

  justify-content: flex-end;

  min-height: 100%;

}



.editor-properties__style-toolbar {

  display: flex;

  gap: $spacing-1;

}



.editor-properties__style-btn {

  min-width: 36px;

  width: 36px;

  height: 36px;

  padding: 0;

}



.editor-properties__style-icon {

  display: inline-block;

  font-family: Georgia, 'Times New Roman', serif;

  font-size: 16px;

  line-height: 1;

  color: inherit;



  &--bold {

    font-weight: 700;

  }



  &--italic {

    font-style: italic;

    font-weight: 600;

  }

}



.editor-properties__weight-field {

  display: flex;

  flex-direction: column;

  justify-content: flex-end;

  min-height: 100%;

}



.editor-properties__weight-toggle {

  width: 100%;

}


.editor-properties__image-preview {

  display: flex;

  flex-direction: column;

  gap: $spacing-2;



  img {

    width: 100%;

    max-height: 140px;

    object-fit: cover;

    border-radius: $radius-md;

  }

}



.editor-properties__meta {

  margin: 0;

  font-size: $font-size-body-sm;

  color: $text-secondary;

}



.editor-properties__delete {

  align-self: flex-start;

}



.editor-properties__hint {

  display: flex;

  flex-direction: column;

  align-items: center;

  gap: $spacing-3;

  padding: $spacing-4 0;

  text-align: center;

  color: $text-muted;

  font-size: $font-size-body-sm;

}

</style>


