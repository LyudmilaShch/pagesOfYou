<template>
  <aside class="editor-properties order-properties" aria-label="Свойства поля">
    <div class="editor-properties__header">
      <p class="editor-properties__eyebrow">Свойства</p>
      <h2 class="editor-properties__title">{{ panelTitle }}</h2>
    </div>

    <div class="editor-properties__body">
      <div v-if="!selectedElement" class="editor-properties__section">
        <p class="editor-properties__section-title">Страница</p>
        <p v-if="isSpreadPage" class="editor-properties__spread-note">
          Разворот из двух страниц A4. Координаты X, направляющие и выравнивание считаются отдельно для
          левой и правой страницы (0…595 pt на каждой).
        </p>
        <p class="editor-properties__meta">
          Дважды нажмите на поле, чтобы быстро заполнить его на странице.
        </p>
      </div>

      <div v-if="!selectedElement" class="editor-properties__hint">
        <v-icon size="28" color="textMuted">mdi-cursor-default-outline</v-icon>
        <p>Выберите поле на странице или дважды нажмите на него для заполнения.</p>
      </div>

      <template v-else>
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
              :model-value="selectedElement.position.y"
              label="Y"
              type="number"
              variant="outlined"
              density="compact"
              hide-details
              @update:model-value="updatePosition('y', $event)"
            />
            <v-text-field
              :model-value="selectedElement.size.width"
              label="Ширина"
              type="number"
              variant="outlined"
              density="compact"
              hide-details
              @update:model-value="updateSize('width', $event)"
            />
            <v-text-field
              :model-value="selectedElement.size.height"
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
                @click="emit('align-to-page-center', 'horizontal')"
              >
                <v-icon size="18">mdi-format-horizontal-align-center</v-icon>
              </v-btn>
              <v-btn
                icon
                size="small"
                variant="outlined"
                title="По центру по вертикали"
                @click="emit('align-to-page-center', 'vertical')"
              >
                <v-icon size="18">mdi-format-vertical-align-center</v-icon>
              </v-btn>
              <v-btn
                icon
                size="small"
                variant="outlined"
                title="По центру страницы"
                @click="emit('align-to-page-center', 'both')"
              >
                <v-icon size="18">mdi-target</v-icon>
              </v-btn>
            </div>
          </div>
        </div>

        <div v-if="isTextElement" class="editor-properties__section">
          <p class="editor-properties__section-title">Ваш текст</p>

          <v-text-field
            v-if="inputKind === 'date'"
            :model-value="textValue"
            type="date"
            label="Дата"
            variant="outlined"
            density="compact"
            hide-details="auto"
            @update:model-value="emit('update-text', selectedElement.id, $event)"
          />

          <v-textarea
            v-else-if="selectedElement.type === 'text-placeholder'"
            :model-value="textValue"
            label="Текст"
            variant="outlined"
            density="compact"
            rows="2"
            auto-grow
            hide-details="auto"
            :counter="maxLength"
            @update:model-value="emit('update-text', selectedElement.id, $event)"
          />

          <v-text-field
            v-else
            :model-value="textValue"
            label="Текст"
            variant="outlined"
            density="compact"
            hide-details="auto"
            :counter="maxLength"
            @update:model-value="emit('update-text', selectedElement.id, $event)"
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
                      @update:model-value="
                        patchElement({ letterSpacing: toNumber($event, textElement.letterSpacing) })
                      "
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
                      @update:model-value="
                        patchElement({ lineHeight: toNumber($event, textElement.lineHeight) })
                      "
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
        </div>

        <div v-if="isPhotoElement" class="editor-properties__section">
          <p class="editor-properties__section-title">Ваше фото</p>

          <div v-if="photoPreviewUrl" class="editor-properties__image-preview">
            <img :src="photoPreviewUrl" :alt="fieldLabel" />
            <v-btn size="small" variant="text" color="error" @click="emit('clear-photo', selectedElement.id)">
              Удалить
            </v-btn>
          </div>

          <v-btn
            variant="outlined"
            size="small"
            prepend-icon="mdi-image-plus-outline"
            :loading="uploading"
            @click="triggerImageInput"
          >
            {{ photoPreviewUrl ? 'Заменить фото' : 'Загрузить фото' }}
          </v-btn>

          <input
            ref="imageInputRef"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            @change="onImageSelected"
          />

          <v-btn
            v-if="photoPreviewUrl"
            variant="outlined"
            size="small"
            prepend-icon="mdi-crop"
            :color="photoCropActive ? 'primary' : undefined"
            @click="togglePhotoCrop"
          >
            {{ photoCropActive ? 'Завершить кадрирование' : 'Кадрировать' }}
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

          <p class="editor-properties__hint-inline">
            Дважды нажмите на фото на странице, чтобы загрузить, заменить или кадрировать.
          </p>
        </div>

        <div v-if="isShapeElement" class="editor-properties__section">
          <p class="editor-properties__section-title">{{ isLineElement ? 'Линия' : 'Фигура' }}</p>
          <EditorShapeStrokeFields
            :element="shapeElement"
            :show-fill="!isLineElement"
            :optional-stroke="!isLineElement"
            stroke-label="Цвет"
            :stroke-width-label="isLineElement ? 'Толщина' : 'Толщина'"
            @patch="patchElement"
          />
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
  EDITOR_FONT_OPTIONS,
} from '@/modules/editor/constants/page.constants'
import {
  getSpreadPageSide,
  getSpreadPageSideLabel,
  spreadGlobalXToPageLocal,
  spreadPageLocalXToGlobal,
} from '@/modules/editor/utils/spread.util'
import type { PageElement } from '@/modules/editor/models'
import type { PhotoPlaceholder } from '@/modules/editor/models/photo-placeholder.model'
import type { TextAlign, TextPlaceholder, TextVerticalAlign } from '@/modules/editor/models/text-placeholder.model'
import type { ShapeElement } from '@/modules/editor/models/shape-element.model'
import EditorShapeStrokeFields from '@/modules/editor/components/EditorShapeStrokeFields.vue'
import EditorColorPicker from '@/modules/editor/components/EditorColorPicker.vue'
import EditorBorderFields from '@/modules/editor/components/EditorBorderFields.vue'
import {
  isPhotoPlaceholderElement,
  isTextPlaceholderElement,
} from '@/modules/editor/utils/placeholder-display.util'
import { resolveAssetUrl } from '@/shared/config/assets'
import { normalizeElementRotation } from '@/modules/editor/utils/transformer.util'
import type { OrderElementPatch } from '../composables/useOrderFillSession'
import { getPlaceholderLabel, isDatePlaceholder } from '../utils/placeholder.utils'

const props = defineProps<{
  selectedElement: PageElement | null
  textValue: string
  photoUrl?: string
  isSpreadPage: boolean
  uploading?: boolean
  photoCropActive?: boolean
}>()

const emit = defineEmits<{
  'patch-element': [elementId: string, patch: OrderElementPatch]
  'update-text': [elementId: string, value: string | null | undefined]
  'upload-photo': [elementId: string, file: File]
  'clear-photo': [elementId: string]
  'start-photo-crop': [elementId: string]
  'stop-photo-crop': []
  'align-to-page-center': [axis: 'horizontal' | 'vertical' | 'both']
}>()

const imageInputRef = ref<HTMLInputElement | null>(null)
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

const panelTitle = computed(() => {
  if (!props.selectedElement) {
    return 'Страница'
  }

  return getPlaceholderLabel(props.selectedElement)
})

const selectedSpreadSide = computed(() => {
  if (!props.isSpreadPage || !props.selectedElement) {
    return null
  }

  return getSpreadPageSide(
    props.selectedElement.position.x,
    A4_SPREAD_PAGE_WIDTH,
    A4_SPREAD_PAGE_HEIGHT,
    props.selectedElement.size.width,
  )
})

const displayPositionX = computed(() => {
  if (!props.selectedElement) {
    return 0
  }

  if (!selectedSpreadSide.value) {
    return props.selectedElement.position.x
  }

  return spreadGlobalXToPageLocal(
    props.selectedElement.position.x,
    selectedSpreadSide.value,
  )
})

const positionXLabel = computed(() =>
  selectedSpreadSide.value
    ? `X (${getSpreadPageSideLabel(selectedSpreadSide.value)})`
    : 'X',
)

const displayRotation = computed(() =>
  props.selectedElement
    ? normalizeElementRotation(props.selectedElement.rotation, 0)
    : 0,
)

const fieldLabel = computed(() =>
  props.selectedElement ? getPlaceholderLabel(props.selectedElement) : '',
)

const isTextElement = computed(
  () => props.selectedElement && isTextPlaceholderElement(props.selectedElement),
)

const isPhotoElement = computed(
  () => props.selectedElement && isPhotoPlaceholderElement(props.selectedElement),
)

const isShapeElement = computed(
  () =>
    props.selectedElement?.type === 'shape-rectangle' ||
    props.selectedElement?.type === 'shape-circle' ||
    props.selectedElement?.type === 'shape-line',
)

const isLineElement = computed(() => props.selectedElement?.type === 'shape-line')

const shapeElement = computed(() => props.selectedElement as ShapeElement)

const textElement = computed(() => props.selectedElement as TextPlaceholder)
const photoElement = computed(() => props.selectedElement as PhotoPlaceholder)

const isTextBold = computed(() => textElement.value?.fontWeight >= 600)
const isTextItalic = computed(() => Boolean(textElement.value?.fontItalic))
const isTextUppercase = computed(() => textElement.value?.textTransform === 'uppercase')

const hasAdvancedTextSpacing = computed(() => {
  if (!textElement.value) {
    return false
  }

  return textElement.value.letterSpacing !== 0 || textElement.value.verticalAlign !== 'top'
})

const inputKind = computed(() =>
  props.selectedElement && isDatePlaceholder(props.selectedElement) ? 'date' : 'text',
)

const maxLength = computed(() => {
  if (!props.selectedElement || props.selectedElement.type === 'photo-placeholder') {
    return undefined
  }

  return (props.selectedElement as { maxLength?: number }).maxLength
})

const photoPreviewUrl = computed(() => {
  if (!props.photoUrl) {
    return null
  }

  return resolveAssetUrl(props.photoUrl)
})

watch(
  () => props.selectedElement?.id,
  () => {
    textSpacingMenuOpen.value = false
  },
)

function toNumber(value: string | number | null | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function patchElement(patch: OrderElementPatch): void {
  if (!props.selectedElement) {
    return
  }

  emit('patch-element', props.selectedElement.id, patch)
}

function updatePosition(axis: 'x' | 'y', value: string | number | null | undefined): void {
  if (!props.selectedElement) {
    return
  }

  if (axis === 'x' && selectedSpreadSide.value) {
    patchElement({
      position: {
        x: spreadPageLocalXToGlobal(
          toNumber(value, displayPositionX.value),
          selectedSpreadSide.value,
        ),
      },
    })
    return
  }

  patchElement({
    position: {
      [axis]: toNumber(value, props.selectedElement.position[axis]),
    },
  })
}

function updateSize(axis: 'width' | 'height', value: string | number | null | undefined): void {
  if (!props.selectedElement) {
    return
  }

  patchElement({
    size: {
      [axis]: toNumber(value, props.selectedElement.size[axis]),
    },
  })
}

function updateRotation(value: string | number | null | undefined): void {
  if (!props.selectedElement || isTextPlaceholderElement(props.selectedElement)) {
    return
  }

  patchElement({
    rotation: normalizeElementRotation(value, props.selectedElement.rotation ?? 0),
  })
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

function setTextAlign(value: TextAlign): void {
  patchElement({ textAlign: value })
}

function setVerticalAlign(value: TextVerticalAlign): void {
  patchElement({ verticalAlign: value })
}

function triggerImageInput(): void {
  imageInputRef.value?.click()
}

function onImageSelected(event: Event): void {
  if (!props.selectedElement) {
    return
  }

  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  emit('upload-photo', props.selectedElement.id, file)
  input.value = ''
}

function togglePhotoCrop(): void {
  if (!props.selectedElement) {
    return
  }

  if (props.photoCropActive) {
    emit('stop-photo-crop')
    return
  }

  emit('start-photo-crop', props.selectedElement.id)
}
</script>

<style scoped lang="scss">
.order-properties {
  min-height: 0;
  height: 100%;
  border: none;
  border-left: 1px solid $border-light;
  border-radius: 0;
  overflow: hidden;
}

.editor-properties {
  display: flex;
  flex-direction: column;
  height: 100%;
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
  flex: 1;
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

.editor-properties__section-title--nested {
  margin-top: $spacing-4;
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
  margin: 0;
  font-size: $font-size-caption;
  color: $text-muted;
}

.editor-properties__meta {
  margin: 0;
  font-size: $font-size-body-sm;
  color: $text-secondary;
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

.editor-properties__style-btn {
  min-width: 36px;
}

.editor-properties__style-icon {
  font-size: 14px;
  line-height: 1;
}

.editor-properties__style-icon--bold {
  font-weight: 700;
}

.editor-properties__style-icon--italic {
  font-style: italic;
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
}

.editor-properties__spacing-label {
  font-size: $font-size-caption;
  color: $text-muted;
}

.editor-properties__spacing-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  gap: $spacing-2;
  align-items: center;
}

.editor-properties__spacing-align {
  display: flex;
  gap: $spacing-1;
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

.editor-properties__hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-8 $spacing-4;
  text-align: center;
  color: $text-muted;
  font-size: $font-size-body-sm;
}
</style>
