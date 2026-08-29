<template>
  <div
    v-if="selected || pageMode"
    ref="dockRootRef"
    class="mobile-dock"
    :style="dockDragStyle"
  >

      <div
        v-if="expanded"
        class="mobile-dock__handle"
        @pointerdown="onHandlePointerDown"
        @pointermove="onHandlePointerMove"
        @pointerup="onHandlePointerUp"
        @pointercancel="onHandlePointerUp"
      >
        <span class="mobile-dock__handle-bar" />
      </div>

      <div class="mobile-dock__expand" :class="{ 'mobile-dock__expand--open': expanded }">
        <div class="mobile-dock__scroll">

          <template v-if="!panelStack.isRoot.value">
            <PropertiesPanelScreenHeader :title="panelStack.current.value.title ?? ''" @back="panelStack.pop" />
            <div class="mobile-dock__screen-body">
              <component :is="panelScreenComponent" />
            </div>
          </template>

          <template v-else>

            <p class="mobile-dock__panel-title">{{ activeCategoryLabel }}</p>

            <!-- ============ TEXT ============ -->
            <template v-if="isTextElement">

              <template v-if="activeCategory === 'content'">
                <label class="mobile-dock__field">
                  <span class="mobile-dock__field-label">Название поля</span>
                  <input
                    type="text"
                    :value="textElement.label"
                    @change="patchElement({ label: ($event.target as HTMLInputElement).value })"
                  />
                </label>
                <label class="mobile-dock__field">
                  <span class="mobile-dock__field-label">Значение по умолчанию</span>
                  <textarea
                    :value="textElement.defaultText ?? ''"
                    @change="patchElement({ defaultText: ($event.target as HTMLTextAreaElement).value })"
                  />
                </label>
              </template>

              <template v-if="activeCategory === 'font'">
                <label class="mobile-dock__field">
                  <span class="mobile-dock__field-label">Шрифт</span>
                  <v-select
                    class="mobile-dock__vselect"
                    :model-value="textElement.fontFamily"
                    :items="fontOptions"
                    item-title="title"
                    item-value="value"
                    variant="outlined"
                    density="compact"
                    hide-details
                    @update:model-value="patchElement({ fontFamily: String($event ?? '') })"
                  />
                </label>

                <div class="mobile-dock__size-row">
                  <div class="mobile-dock__size-box">
                    <input
                      type="number"
                      min="1"
                      :value="textElement.fontSize"
                      @change="patchElement({ fontSize: toNumber(($event.target as HTMLInputElement).value, textElement.fontSize) })"
                    />
                    <span class="mobile-dock__unit">px</span>
                  </div>
                  <div class="mobile-dock__stepper">
                    <button type="button" aria-label="Увеличить" @click="patchElement({ fontSize: textElement.fontSize + 1 })">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button type="button" aria-label="Уменьшить" @click="patchElement({ fontSize: Math.max(1, textElement.fontSize - 1) })">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 9l7 7 7-7" /></svg>
                    </button>
                  </div>
                </div>

                <p class="mobile-dock__label-static">Начертание</p>
                <div class="mobile-dock__fmt-row">
                  <button type="button" class="mobile-dock__fmt-btn" :class="{ active: isTextBold }" style="font-weight:700;" @click="toggleBold">B</button>
                  <button type="button" class="mobile-dock__fmt-btn" :class="{ active: isTextItalic }" @click="toggleItalic"><i>I</i></button>
                  <button type="button" class="mobile-dock__fmt-btn" :class="{ active: isTextUppercase }" @click="toggleUppercase">Aa</button>
                </div>

                <p class="mobile-dock__label-static">Выравнивание текста</p>
                <div class="mobile-dock__align-row">
                  <button type="button" class="mobile-dock__align-btn" :class="{ active: textElement.textAlign === 'left' }" aria-label="По левому краю" @click="setTextAlign('left')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M4 12h10M4 18h13" /></svg>
                  </button>
                  <button type="button" class="mobile-dock__align-btn" :class="{ active: textElement.textAlign === 'center' }" aria-label="По центру" @click="setTextAlign('center')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M7 12h10M5.5 18h13" /></svg>
                  </button>
                  <button type="button" class="mobile-dock__align-btn" :class="{ active: textElement.textAlign === 'right' }" aria-label="По правому краю" @click="setTextAlign('right')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M10 12h10M7 18h13" /></svg>
                  </button>
                  <button type="button" class="mobile-dock__align-btn" :class="{ active: textElement.textAlign === 'justify' }" aria-label="По ширине" @click="setTextAlign('justify')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
                </div>

                <p class="mobile-dock__label-static">Расширенная типографика</p>
                <div class="mobile-dock__mini-row">
                  <span class="mobile-dock__mini-label">Высота строки</span>
                  <div class="mobile-dock__mini-num-row">
                    <input
                      class="mobile-dock__mini-num-field"
                      type="number"
                      step="0.05"
                      :value="textElement.lineHeight"
                      @change="patchElement({ lineHeight: toNumber(($event.target as HTMLInputElement).value, textElement.lineHeight) })"
                    />
                    <div class="mobile-dock__mini-stepper">
                      <button type="button" aria-label="Увеличить" @click="patchElement({ lineHeight: Math.min(LINE_HEIGHT_MAX, textElement.lineHeight + 0.05) })">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button type="button" aria-label="Уменьшить" @click="patchElement({ lineHeight: Math.max(LINE_HEIGHT_MIN, textElement.lineHeight - 0.05) })">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 9l7 7 7-7" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div class="mobile-dock__mini-row">
                  <span class="mobile-dock__mini-label">Межбуквенный интервал</span>
                  <div class="mobile-dock__mini-num-row">
                    <input
                      class="mobile-dock__mini-num-field"
                      type="number"
                      step="0.1"
                      :value="textElement.letterSpacing"
                      @change="patchElement({ letterSpacing: toNumber(($event.target as HTMLInputElement).value, textElement.letterSpacing) })"
                    />
                    <div class="mobile-dock__mini-stepper">
                      <button type="button" aria-label="Увеличить" @click="patchElement({ letterSpacing: Math.min(LETTER_SPACING_MAX, textElement.letterSpacing + 0.1) })">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button type="button" aria-label="Уменьшить" @click="patchElement({ letterSpacing: Math.max(LETTER_SPACING_MIN, textElement.letterSpacing - 0.1) })">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 9l7 7 7-7" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div class="mobile-dock__mini-row">
                  <span class="mobile-dock__mini-label">Закрепить поле</span>
                  <div class="mobile-dock__mini-seg">
                    <button type="button" class="mobile-dock__mini-seg-btn" :class="{ active: textElement.verticalAlign === 'bottom' }" aria-label="Снизу" @click="setVerticalAlign('bottom')">
                      <v-icon size="15">mdi-format-vertical-align-bottom</v-icon>
                    </button>
                    <button type="button" class="mobile-dock__mini-seg-btn" :class="{ active: textElement.verticalAlign === 'middle' }" aria-label="По центру" @click="setVerticalAlign('middle')">
                      <v-icon size="15">mdi-format-vertical-align-center</v-icon>
                    </button>
                    <button type="button" class="mobile-dock__mini-seg-btn" :class="{ active: textElement.verticalAlign === 'top' }" aria-label="Сверху" @click="setVerticalAlign('top')">
                      <v-icon size="15">mdi-format-vertical-align-top</v-icon>
                    </button>
                  </div>
                </div>
              </template>

              <template v-if="activeCategory === 'color'">
                <EditorColorPicker
                  :model-value="textElement.color"
                  label="Цвет текста"
                  fallback="#111111"
                  @update:model-value="patchElement({ color: $event })"
                />
              </template>

              <template v-if="activeCategory === 'effects'">
                <div class="mobile-dock__fx-scroll">
                  <button type="button" class="mobile-dock__fx-item" :class="{ active: !textElement.effect }" @click="removeTextEffect">
                    <span class="mobile-dock__fx-thumb">Аа</span>
                    <span class="mobile-dock__fx-label">Нет</span>
                  </button>
                  <button
                    v-for="card in TEXT_EFFECT_CARDS"
                    :key="card.type"
                    type="button"
                    class="mobile-dock__fx-item"
                    :class="{ active: textElement.effect?.type === card.type }"
                    @click="selectTextEffect(card)"
                  >
                    <span class="mobile-dock__fx-thumb" :style="getTextEffectDemoStyle(card.type)">Аа</span>
                    <span class="mobile-dock__fx-label">{{ card.label }}</span>
                  </button>
                </div>
                <button type="button" class="mobile-dock__fx-more" @click="panelStack.push({ id: 'text-effects', title: 'Эффекты' })">
                  Все эффекты
                  <v-icon size="12">mdi-chevron-right</v-icon>
                </button>
              </template>

              <template v-if="activeCategory === 'behavior'">
                <div class="mobile-dock__toggle-row">
                  <span class="mobile-dock__toggle-label">Обязательное поле</span>
                  <EditorSwitch
                    size="large"
                    :model-value="textElement.required"
                    @update:model-value="patchElement({ required: $event })"
                  />
                </div>
              </template>

            </template>

            <!-- ============ PHOTO ============ -->
            <template v-if="isPhotoElement">

              <template v-if="activeCategory === 'content'">
                <label class="mobile-dock__field">
                  <span class="mobile-dock__field-label">Название поля</span>
                  <input
                    type="text"
                    :value="photoElement.label"
                    @change="patchElement({ label: ($event.target as HTMLInputElement).value })"
                  />
                </label>
                <p class="mobile-dock__label-static">Изображение по умолчанию</p>
                <div class="mobile-dock__default-image-row">
                  <div class="mobile-dock__image-thumb">
                    <img v-if="photoElement.defaultImageUrl" :src="displayImageUrl" alt="" />
                  </div>
                  <button type="button" class="mobile-dock__btn-compact" :disabled="uploadingImage" @click="triggerImageInput">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V4M8 8l4-4 4 4" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
                    {{ photoElement.defaultImageUrl ? 'Заменить' : 'Загрузить' }}
                  </button>
                  <input ref="imageInputRef" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onImageSelected" />
                </div>
              </template>

              <template v-if="activeCategory === 'image'">
                <div class="mobile-dock__setting-row">
                  <span class="mobile-dock__setting-label">Масштабирование</span>
                  <v-select
                    class="mobile-dock__vselect mobile-dock__vselect--compact"
                    :model-value="photoElement.fitMode"
                    :items="fitModeOptions"
                    item-title="label"
                    item-value="value"
                    variant="outlined"
                    density="compact"
                    hide-details
                    @update:model-value="patchElement({ fitMode: $event as typeof photoElement.fitMode })"
                  />
                </div>
                <div v-if="photoElement.defaultImageUrl" class="mobile-dock__setting-row">
                  <span class="mobile-dock__setting-label">Кадрирование</span>
                  <button type="button" class="mobile-dock__btn-compact" @click="store.startPhotoDim(selected!.id)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2v14a2 2 0 002 2h14" /><path d="M18 22V8a2 2 0 00-2-2H2" /></svg>
                    Кадрировать
                  </button>
                </div>
              </template>

              <template v-if="activeCategory === 'decoration'">
                <p class="mobile-dock__label-static">Скругление</p>
                <div class="mobile-dock__slider-row">
                  <v-slider
                    class="mobile-dock__vslider"
                    :model-value="photoElement.borderRadius"
                    :min="0"
                    :max="60"
                    :step="1"
                    hide-details
                    @update:model-value="patchElement({ borderRadius: Number($event) })"
                  />
                  <input
                    type="number"
                    class="mobile-dock__slider-value"
                    :value="photoElement.borderRadius"
                    @change="patchElement({ borderRadius: toNumber(($event.target as HTMLInputElement).value, photoElement.borderRadius) })"
                  />
                </div>
                <EditorBorderFields
                  v-if="!photoElement.frame"
                  :stroke="photoElement.stroke"
                  :stroke-width="photoElement.strokeWidth"
                  :stroke-style="photoElement.strokeStyle"
                  :stroke-position="photoElement.strokePosition"
                  @patch="patchElement"
                />
              </template>

              <template v-if="activeCategory === 'frame'">
                <div class="mobile-dock__fx-scroll">
                  <button type="button" class="mobile-dock__fx-item mobile-dock__fx-item--frame" :class="{ active: !photoElement.frame }" @click="removePhotoFrame">
                    <span class="mobile-dock__fx-thumb mobile-dock__fx-thumb--frame"><v-icon size="24" color="textMuted">mdi-image-frame</v-icon></span>
                    <span class="mobile-dock__fx-label">Без рамки</span>
                  </button>
                  <button
                    v-for="item in activePhotoFrames"
                    :key="item.id"
                    type="button"
                    class="mobile-dock__fx-item mobile-dock__fx-item--frame"
                    :class="{ active: photoElement.frame?.imageUrl === item.imageUrl }"
                    @click="selectPhotoFrame(item)"
                  >
                    <span class="mobile-dock__fx-thumb mobile-dock__fx-thumb--frame"><img :src="item.imageUrl" :alt="item.name" /></span>
                    <span class="mobile-dock__fx-label">{{ item.name }}</span>
                  </button>
                </div>
                <button type="button" class="mobile-dock__fx-more" @click="panelStack.push({ id: 'photo-frame', title: 'Рамка' })">
                  Все рамки
                  <v-icon size="12">mdi-chevron-right</v-icon>
                </button>
              </template>

              <template v-if="activeCategory === 'filters'">
                <div class="mobile-dock__fx-scroll">
                  <button type="button" class="mobile-dock__fx-item" :class="{ active: !photoElement.filter }" @click="removePhotoFilter">
                    <span class="mobile-dock__fx-thumb">
                      <img v-if="displayImageUrl" :src="displayImageUrl" alt="" />
                      <v-icon v-else size="20" color="textMuted">mdi-image-outline</v-icon>
                    </span>
                    <span class="mobile-dock__fx-label">Нет</span>
                  </button>
                  <button
                    v-for="preset in PHOTO_FILTER_PRESETS"
                    :key="preset.key"
                    type="button"
                    class="mobile-dock__fx-item"
                    :class="{ active: isPhotoFilterPresetActive(preset.key) }"
                    @click="selectPhotoFilter(preset.key)"
                  >
                    <span class="mobile-dock__fx-thumb">
                      <img v-if="displayImageUrl" :src="displayImageUrl" alt="" :style="{ filter: getCssFilterPreview(preset.correction) }" />
                      <v-icon v-else size="20" color="textMuted">mdi-image-outline</v-icon>
                    </span>
                    <span class="mobile-dock__fx-label">{{ preset.label }}</span>
                  </button>
                </div>
                <button type="button" class="mobile-dock__fx-more" @click="panelStack.push({ id: 'photo-filters', title: 'Фильтры' })">
                  Все фильтры
                  <v-icon size="12">mdi-chevron-right</v-icon>
                </button>
              </template>

              <template v-if="activeCategory === 'mask'">
                <div class="mobile-dock__fx-scroll">
                  <button type="button" class="mobile-dock__fx-item" :class="{ active: !photoElement.mask }" @click="removePhotoMask">
                    <span class="mobile-dock__fx-thumb">
                      <img v-if="displayImageUrl" :src="displayImageUrl" alt="" />
                      <v-icon v-else size="20" color="textMuted">mdi-image-outline</v-icon>
                    </span>
                    <span class="mobile-dock__fx-label">Нет</span>
                  </button>
                  <button
                    v-for="def in PHOTO_MASK_DESCRIPTORS"
                    :key="def.type"
                    type="button"
                    class="mobile-dock__fx-item"
                    :class="{ active: photoElement.mask?.type === def.type }"
                    @click="selectPhotoMask(def.type)"
                  >
                    <span class="mobile-dock__fx-thumb">
                      <img v-if="displayImageUrl" :src="displayImageUrl" alt="" :style="{ clipPath: def.cssClipPath }" />
                      <v-icon v-else size="20" color="textMuted">mdi-image-outline</v-icon>
                    </span>
                    <span class="mobile-dock__fx-label">{{ def.label }}</span>
                  </button>
                </div>
                <button type="button" class="mobile-dock__fx-more" @click="panelStack.push({ id: 'photo-mask', title: 'Маска' })">
                  Все маски
                  <v-icon size="12">mdi-chevron-right</v-icon>
                </button>
              </template>

              <template v-if="activeCategory === 'behavior'">
                <div class="mobile-dock__toggle-row">
                  <span class="mobile-dock__toggle-label">Обязательное поле</span>
                  <EditorSwitch
                    size="large"
                    :model-value="photoElement.required"
                    @update:model-value="patchElement({ required: $event })"
                  />
                </div>
              </template>

            </template>

            <!-- ============ SHAPE ============ -->
            <template v-if="isShapeElement">

              <template v-if="activeCategory === 'shape'">
                <EditorShapeStrokeFields
                  :element="shapeElement"
                  :show-fill="!isLineElement"
                  :show-corner-radius="isRectangleElement"
                  :optional-stroke="!isLineElement"
                  stroke-width-label="Толщина"
                  @patch="(patch) => patchElement(patch as ElementPatch)"
                />
              </template>

              <template v-if="activeCategory === 'shadow'">
                <div class="mobile-dock__fx-scroll">
                  <button type="button" class="mobile-dock__fx-item" :class="{ active: !shapeElement.shadow }" @click="removeShapeShadow">
                    <span class="mobile-dock__fx-thumb"><v-icon size="22" color="textMuted">mdi-square-off-outline</v-icon></span>
                    <span class="mobile-dock__fx-label">Нет</span>
                  </button>
                  <button
                    v-for="def in SHAPE_SHADOW_DESCRIPTORS"
                    :key="def.type"
                    type="button"
                    class="mobile-dock__fx-item"
                    :class="{ active: shapeElement.shadow?.type === def.type }"
                    @click="selectShapeShadow(def.type)"
                  >
                    <span class="mobile-dock__fx-thumb"><v-icon size="22">{{ SHAPE_SHADOW_ICONS[def.type] }}</v-icon></span>
                    <span class="mobile-dock__fx-label">{{ def.label }}</span>
                  </button>
                </div>
                <button type="button" class="mobile-dock__fx-more" @click="panelStack.push({ id: 'shape-shadow', title: 'Тени' })">
                  Все тени
                  <v-icon size="12">mdi-chevron-right</v-icon>
                </button>
              </template>

              <template v-if="activeCategory === 'effects'">
                <div class="mobile-dock__fx-scroll">
                  <button type="button" class="mobile-dock__fx-item" :class="{ active: !shapeElement.visualEffect }" @click="removeShapeVisualEffect">
                    <span class="mobile-dock__fx-thumb"><span class="mobile-dock__fx-swatch" :style="{ background: shapeElement.fill || '#E3DDD5' }" /></span>
                    <span class="mobile-dock__fx-label">Нет</span>
                  </button>
                  <button
                    v-for="def in SHAPE_VISUAL_EFFECT_DESCRIPTORS"
                    :key="def.type"
                    type="button"
                    class="mobile-dock__fx-item"
                    :class="{ active: shapeElement.visualEffect?.type === def.type }"
                    @click="selectShapeVisualEffect(def)"
                  >
                    <span class="mobile-dock__fx-thumb"><span class="mobile-dock__fx-swatch" :style="getShapeVisualEffectPreviewStyle(def.type, shapeElement.fill || '#E3DDD5')" /></span>
                    <span class="mobile-dock__fx-label">{{ def.label }}</span>
                  </button>
                </div>
                <button type="button" class="mobile-dock__fx-more" @click="panelStack.push({ id: 'shape-visual-effect', title: 'Эффекты' })">
                  Все эффекты
                  <v-icon size="12">mdi-chevron-right</v-icon>
                </button>
              </template>

            </template>

            <!-- ============ PAGE (nothing selected) ============ -->
            <template v-if="pageMode">

              <template v-if="activeCategory === 'size'">
                <label class="mobile-dock__field">
                  <span class="mobile-dock__field-label">Размер страницы</span>
                  <v-select
                    class="mobile-dock__vselect"
                    :model-value="pagePreset"
                    :items="pagePresetItems"
                    item-title="label"
                    item-value="key"
                    variant="outlined"
                    density="compact"
                    hide-details
                    :disabled="store.isSpreadPage"
                    @update:model-value="applyPagePreset"
                  />
                </label>
                <div class="mobile-dock__mini-row">
                  <span class="mobile-dock__mini-label">Ширина / Высота</span>
                  <div class="mobile-dock__mini-num-row">
                    <input
                      class="mobile-dock__mini-num-field"
                      type="number"
                      :value="store.pageWidth"
                      :disabled="store.isSpreadPage"
                      @change="updatePageSize('width', ($event.target as HTMLInputElement).value)"
                    />
                    <input
                      class="mobile-dock__mini-num-field"
                      type="number"
                      :value="store.pageHeight"
                      :disabled="store.isSpreadPage"
                      @change="updatePageSize('height', ($event.target as HTMLInputElement).value)"
                    />
                  </div>
                </div>
              </template>

              <template v-if="activeCategory === 'background'">
                <template v-if="store.isSpreadPage">
                  <p class="mobile-dock__label-static">
                    Для разворотов фон каждой страницы настраивается отдельно — откройте редактор на компьютере.
                  </p>
                </template>
                <template v-else>
                  <EditorColorPicker
                    :model-value="editablePageBackground.backgroundColor"
                    label="Цвет фона"
                    fallback="#FFFFFF"
                    @update:model-value="updateBackgroundColor"
                  />

                  <div v-if="editablePageBackground.backgroundImageUrl" class="mobile-dock__default-image-row">
                    <div class="mobile-dock__image-thumb">
                      <img :src="pageBackgroundImagePreviewUrl" alt="" />
                    </div>
                    <button type="button" class="mobile-dock__btn-compact" @click="removePageBackgroundImage">
                      Удалить
                    </button>
                  </div>

                  <button type="button" class="mobile-dock__btn-compact" :disabled="uploadingPageBackgroundImage" @click="triggerPageBackgroundInput">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V4M8 8l4-4 4 4" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
                    {{ editablePageBackground.backgroundImageUrl ? 'Заменить изображение' : 'Загрузить изображение' }}
                  </button>
                  <input
                    ref="pageBackgroundInputRef"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    @change="onPageBackgroundSelected"
                  />

                  <button
                    v-if="editablePageBackground.backgroundImageUrl"
                    type="button"
                    class="mobile-dock__btn-compact"
                    :disabled="store.previewMode"
                    @click="handleStartPageBackgroundCrop"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2v14a2 2 0 002 2h14" /><path d="M18 22V8a2 2 0 00-2-2H2" /></svg>
                    Кадрировать
                  </button>

                  <label v-if="editablePageBackground.backgroundImageUrl" class="mobile-dock__field">
                    <span class="mobile-dock__field-label">Масштабирование</span>
                    <v-select
                      class="mobile-dock__vselect"
                      :model-value="editablePageBackground.backgroundImageFit"
                      :items="pageBackgroundFitOptions"
                      item-title="title"
                      item-value="value"
                      variant="outlined"
                      density="compact"
                      hide-details
                      @update:model-value="updatePageBackgroundFit"
                    />
                  </label>
                </template>
              </template>

            </template>

            <!-- ============ POSITION (shared) ============ -->
            <template v-if="selected && activeCategory === 'position'">
              <p class="mobile-dock__label-static">Выравнивание</p>
              <div class="mobile-dock__align-canvas-row">
                <button type="button" class="mobile-dock__align-canvas-btn" aria-label="По центру по горизонтали" @click="alignToPageCenter('horizontal')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4v16" /><path d="M3 12h6M9 12l-2.5-2.5M9 12l-2.5 2.5" /><path d="M21 12h-6M15 12l2.5-2.5M15 12l2.5 2.5" /></svg>
                </button>
                <button type="button" class="mobile-dock__align-canvas-btn" aria-label="По центру по вертикали" @click="alignToPageCenter('vertical')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 12h16" /><path d="M12 3v6M12 9l-2.5-2.5M12 9l2.5-2.5" /><path d="M12 21v-6M12 15l-2.5 2.5M12 15l2.5 2.5" /></svg>
                </button>
                <button type="button" class="mobile-dock__align-canvas-btn" aria-label="По центру страницы" @click="alignToPageCenter('both')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
                </button>
              </div>

              <p class="mobile-dock__label-static">Поворот</p>
              <div class="mobile-dock__size-row">
                <div class="mobile-dock__size-box">
                  <input
                    type="number"
                    :value="displayRotation"
                    @change="updateRotation(($event.target as HTMLInputElement).value)"
                  />
                  <span class="mobile-dock__unit">°</span>
                </div>
                <div class="mobile-dock__stepper">
                  <button type="button" aria-label="Увеличить" @click="updateRotation(displayRotation + 1)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button type="button" aria-label="Уменьшить" @click="updateRotation(displayRotation - 1)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 9l7 7 7-7" /></svg>
                  </button>
                </div>
                <button type="button" class="mobile-dock__align-canvas-btn mobile-dock__align-canvas-btn--sm" aria-label="Повернуть на -90°" @click="rotateBy(-90)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9a8 8 0 1 1 1.3 7.7" /><path d="M4 4v5h5" /></svg>
                </button>
                <button type="button" class="mobile-dock__align-canvas-btn mobile-dock__align-canvas-btn--sm" aria-label="Повернуть на +90°" @click="rotateBy(90)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 9a8 8 0 1 0-1.3 7.7" /><path d="M20 4v5h-5" /></svg>
                </button>
              </div>

              <div class="mobile-dock__mini-row">
                <span class="mobile-dock__mini-label">{{ positionLabel }}</span>
                <div class="mobile-dock__mini-num-row">
                  <input
                    class="mobile-dock__mini-num-field"
                    type="number"
                    :value="displayPositionX"
                    @change="updatePosition('x', ($event.target as HTMLInputElement).value)"
                  />
                  <input
                    class="mobile-dock__mini-num-field"
                    type="number"
                    :value="selected.position.y"
                    @change="updatePosition('y', ($event.target as HTMLInputElement).value)"
                  />
                </div>
              </div>
              <div class="mobile-dock__mini-row">
                <span class="mobile-dock__mini-label">Ширина / Высота</span>
                <div class="mobile-dock__mini-num-row">
                  <input
                    class="mobile-dock__mini-num-field"
                    type="number"
                    :value="selected.size.width"
                    @change="updateSize('width', ($event.target as HTMLInputElement).value)"
                  />
                  <input
                    class="mobile-dock__mini-num-field"
                    type="number"
                    :value="selected.size.height"
                    @change="updateSize('height', ($event.target as HTMLInputElement).value)"
                  />
                </div>
              </div>
            </template>

          </template>

        </div>
      </div>

      <div class="mobile-dock__chip-strip">
        <button
          v-for="chip in chips"
          :key="chip.id"
          type="button"
          class="mobile-dock__chip"
          :class="{ active: activeCategory === chip.id && expanded }"
          @click="onChipClick(chip.id)"
        >
          <v-icon size="20">{{ chip.mdiIcon }}</v-icon>
          <span>{{ chip.label }}</span>
        </button>

        <template v-if="selected">
          <div class="mobile-dock__chip-sep" />

          <button type="button" class="mobile-dock__chip" :disabled="store.previewMode" @click="handleDuplicate">
            <v-icon size="20">mdi-content-copy</v-icon>
            <span>Дублировать</span>
          </button>
          <button type="button" class="mobile-dock__chip mobile-dock__chip--danger" :disabled="store.previewMode" @click="handleRemove">
            <v-icon size="20">mdi-delete-outline</v-icon>
            <span>Удалить</span>
          </button>
        </template>
      </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import { useEditorStore } from '../store/editor.store'
import type { ElementPatch } from '../store/editor.store'
import { usePropertiesPanelStack } from '../composables/use-properties-panel-stack'
import { PROPERTIES_PANEL_STACK_KEY } from '../composables/properties-panel-stack.context'
import { provide } from 'vue'
import PropertiesPanelScreenHeader from './properties-panel/PropertiesPanelScreenHeader.vue'
import { PANEL_SCREENS, type PanelScreenId } from './properties-panel/panel-screen-registry'
import { TEXT_EFFECT_CARDS, getTextEffectDemoStyle } from '../models/text-effect.model'
import type { TextEffect, TextEffectCardDef } from '../models/text-effect.model'
import {
  PHOTO_FILTER_PRESETS,
  getPhotoFilterPresetDef,
  getCssFilterPreview,
  isCustomPhotoFilter,
} from '../models/photo-filter.model'
import type { PhotoFilterPresetKey } from '../models/photo-filter.model'
import { SHAPE_SHADOW_DESCRIPTORS, SHAPE_SHADOW_ICONS } from '../models/shape-shadow.model'
import type { ShapeShadow, ShapeShadowType } from '../models/shape-shadow.model'
import { SHAPE_VISUAL_EFFECT_DESCRIPTORS, getShapeVisualEffectPreviewStyle } from '../models/shape-visual-effect.model'
import type { ShapeVisualEffect, ShapeVisualEffectType } from '../models/shape-visual-effect.model'
import type { EffectDescriptor } from '../models/effect-descriptor.model'
import { PHOTO_MASK_DESCRIPTORS } from '../models/photo-mask.model'
import type { PhotoMaskType } from '../models/photo-mask.model'
import type { TextAlign, TextVerticalAlign } from '../models/text-placeholder.model'
import { adminPhotoFramesApi, type AdminPhotoFrame } from '@/shared/api/admin/photo-frames.api'
import { uploadAdminImage } from '@/shared/api/admin/uploads.api'
import { resolveAssetUrl, toStoredAssetPath } from '@/shared/config/assets'
import { useErrorMessageModal } from '@/shared/composables/useErrorMessageModal'
import { getUploadErrorMessage } from '@/shared/utils/api-error.util'
import { mergedFontOptions } from '../utils/custom-fonts.util'
import { isPhotoPlaceholderElement, isTextPlaceholderElement } from '../utils/placeholder-display.util'
import { A4_SPREAD_PAGE_HEIGHT, A4_SPREAD_PAGE_WIDTH, PAGE_SIZE_PRESETS } from '../constants/page.constants'
import { PAGE_BACKGROUND_IMAGE_FIT_OPTIONS } from '../models/page-background.model'
import type { PageBackgroundImageFit } from '../models/page-background.model'
import {
  getSpreadPageSide,
  getSpreadPageSideLabel,
  spreadGlobalXToPageLocal,
  spreadPageLocalXToGlobal,
} from '../utils/spread.util'
import { normalizeElementRotation } from '../utils/transformer.util'
import EditorColorPicker from './EditorColorPicker.vue'
import EditorBorderFields from './EditorBorderFields.vue'
import EditorShapeStrokeFields from './EditorShapeStrokeFields.vue'
import EditorSwitch from './EditorSwitch.vue'

const store = useEditorStore()
const { showErrorMessageModal } = useErrorMessageModal()
const { selectedElement: selected } = storeToRefs(store)

const panelStack = usePropertiesPanelStack(() => ({ id: 'root' }))
provide(PROPERTIES_PANEL_STACK_KEY, {
  push: panelStack.push,
  pop: panelStack.pop,
  isRoot: panelStack.isRoot,
})

const panelScreenComponent = computed(() =>
  panelStack.isRoot.value ? null : PANEL_SCREENS[panelStack.current.value.id as PanelScreenId],
)

const expanded = ref(false)
const activeCategory = ref('content')
const dockRootRef = ref<HTMLElement | null>(null)

function onDocumentPointerDown(event: PointerEvent): void {
  if (!expanded.value) {
    return
  }

  const target = event.target as Node | null
  if (dockRootRef.value && target && !dockRootRef.value.contains(target)) {
    expanded.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
})

const CLOSE_DRAG_THRESHOLD = 90
const CLOSE_DRAG_VELOCITY = 0.5

const dockDragOffset = ref(0)
const dockDragging = ref(false)
let dockDragStartY = 0
let dockDragStartTime = 0

const dockDragStyle = computed(() => ({
  transform: dockDragOffset.value ? `translateY(${dockDragOffset.value}px)` : undefined,
  transition: dockDragging.value ? 'none' : undefined,
}))

function closeDock(): void {
  if (selected.value) {
    store.clearSelection()
  } else {
    store.dismissPageProperties()
  }
}

function onHandlePointerDown(event: PointerEvent): void {
  dockDragging.value = true
  dockDragStartY = event.clientY
  dockDragStartTime = Date.now()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onHandlePointerMove(event: PointerEvent): void {
  if (!dockDragging.value) {
    return
  }

  dockDragOffset.value = Math.max(0, event.clientY - dockDragStartY)
}

function onHandlePointerUp(): void {
  if (!dockDragging.value) {
    return
  }

  dockDragging.value = false

  const distance = dockDragOffset.value
  const elapsed = Math.max(Date.now() - dockDragStartTime, 1)
  const velocity = distance / elapsed
  const shouldClose = distance > CLOSE_DRAG_THRESHOLD || velocity > CLOSE_DRAG_VELOCITY

  dockDragOffset.value = 0

  if (shouldClose) {
    closeDock()
  }
}

const pageMode = computed(() => !store.hasSelection && store.showPropertiesPanel)

watch(
  [() => selected.value?.id, pageMode],
  ([selectedId]) => {
    // A background tap can leave pagePropertiesRequested stale once an element gets selected
    // afterwards (only the page-mode close path clears it) — without this, deselecting that
    // element later falls back to the page dock instead of the idle rail dock.
    if (selectedId) {
      store.dismissPageProperties()
    }

    panelStack.reset({ id: 'root' })
    activeCategory.value = pageMode.value ? 'size' : 'content'
    expanded.value = false
  },
)

function onChipClick(id: string): void {
  if (activeCategory.value === id && expanded.value) {
    expanded.value = false
    return
  }

  activeCategory.value = id
  expanded.value = true
}

interface DockChip {
  id: string
  label: string
  mdiIcon: string
}

const TEXT_CHIPS: DockChip[] = [
  { id: 'content', label: 'Контент', mdiIcon: 'mdi-text-box-outline' },
  { id: 'font', label: 'Шрифт', mdiIcon: 'mdi-format-font' },
  { id: 'color', label: 'Цвет', mdiIcon: 'mdi-palette-outline' },
  { id: 'behavior', label: 'Поведение', mdiIcon: 'mdi-toggle-switch-outline' },
  { id: 'effects', label: 'Эффекты', mdiIcon: 'mdi-star-four-points-outline' },
  { id: 'position', label: 'Позиция', mdiIcon: 'mdi-arrow-all' },
]

const PHOTO_CHIPS: DockChip[] = [
  { id: 'content', label: 'Контент', mdiIcon: 'mdi-text-box-outline' },
  { id: 'image', label: 'Изображение', mdiIcon: 'mdi-image-outline' },
  { id: 'decoration', label: 'Оформление', mdiIcon: 'mdi-square-rounded-outline' },
  { id: 'frame', label: 'Рамка', mdiIcon: 'mdi-image-frame' },
  { id: 'filters', label: 'Фильтры', mdiIcon: 'mdi-tune-variant' },
  { id: 'mask', label: 'Маска', mdiIcon: 'mdi-shape-outline' },
  { id: 'behavior', label: 'Поведение', mdiIcon: 'mdi-toggle-switch-outline' },
  { id: 'position', label: 'Позиция', mdiIcon: 'mdi-arrow-all' },
]

const SHAPE_CHIPS_RECT: DockChip[] = [
  { id: 'shape', label: 'Фигура', mdiIcon: 'mdi-vector-square' },
  { id: 'shadow', label: 'Тени', mdiIcon: 'mdi-square-off-outline' },
  { id: 'effects', label: 'Эффекты', mdiIcon: 'mdi-star-four-points-outline' },
  { id: 'position', label: 'Позиция', mdiIcon: 'mdi-arrow-all' },
]

const SHAPE_CHIPS_LINE: DockChip[] = [
  { id: 'shape', label: 'Линия', mdiIcon: 'mdi-vector-line' },
  { id: 'shadow', label: 'Тени', mdiIcon: 'mdi-square-off-outline' },
  { id: 'effects', label: 'Эффекты', mdiIcon: 'mdi-star-four-points-outline' },
  { id: 'position', label: 'Позиция', mdiIcon: 'mdi-arrow-all' },
]

const PAGE_CHIPS: DockChip[] = [
  { id: 'size', label: 'Размер', mdiIcon: 'mdi-crop' },
  { id: 'background', label: 'Фон', mdiIcon: 'mdi-palette-outline' },
]

const isTextElement = computed(() => Boolean(selected.value && isTextPlaceholderElement(selected.value)))
const isPhotoElement = computed(() => Boolean(selected.value && isPhotoPlaceholderElement(selected.value)))
const isShapeElement = computed(
  () =>
    selected.value?.type === 'shape-rectangle' ||
    selected.value?.type === 'shape-circle' ||
    selected.value?.type === 'shape-line',
)
const isLineElement = computed(() => selected.value?.type === 'shape-line')
const isRectangleElement = computed(() => selected.value?.type === 'shape-rectangle')

const textElement = computed(() => selected.value as import('../models/text-placeholder.model').TextPlaceholder)
const photoElement = computed(() => selected.value as import('../models/photo-placeholder.model').PhotoPlaceholder)
const shapeElement = computed(() => selected.value as import('../models/shape-element.model').ShapeElement)

const chips = computed<DockChip[]>(() => {
  if (isTextElement.value) {
    return TEXT_CHIPS
  }
  if (isPhotoElement.value) {
    return PHOTO_CHIPS
  }
  if (isShapeElement.value) {
    return isLineElement.value ? SHAPE_CHIPS_LINE : SHAPE_CHIPS_RECT
  }
  if (pageMode.value) {
    return PAGE_CHIPS
  }
  return []
})

const activeCategoryLabel = computed(
  () => chips.value.find((chip) => chip.id === activeCategory.value)?.label ?? '',
)

const pagePresetItems = PAGE_SIZE_PRESETS.map((preset, index) => ({
  key: String(index),
  label: `${preset.label} (${preset.width}×${preset.height})`,
  width: preset.width,
  height: preset.height,
}))

const pagePreset = computed(() => {
  const match = pagePresetItems.findIndex(
    (item) => item.width === store.pageWidth && item.height === store.pageHeight,
  )
  return match >= 0 ? String(match) : 'custom'
})

function applyPagePreset(key: string): void {
  const preset = pagePresetItems[Number(key)]
  if (!preset) {
    return
  }
  store.updatePageSettings({ width: preset.width, height: preset.height })
}

function updatePageSize(axis: 'width' | 'height', value: string | number | null | undefined): void {
  store.updatePageSettings({ [axis]: toNumber(value, axis === 'width' ? store.pageWidth : store.pageHeight) })
}

const pageBackgroundFitOptions = PAGE_BACKGROUND_IMAGE_FIT_OPTIONS
const editablePageBackground = computed(() => store.editablePageBackground)
const pageBackgroundImagePreviewUrl = computed(
  () => resolveAssetUrl(editablePageBackground.value.backgroundImageUrl) ?? '',
)

const pageBackgroundInputRef = ref<HTMLInputElement | null>(null)
const uploadingPageBackgroundImage = ref(false)

function updateBackgroundColor(value: string | null | undefined): void {
  if (!value?.trim()) {
    return
  }
  store.updatePageSettings({ backgroundColor: value.trim() })
}

function triggerPageBackgroundInput(): void {
  pageBackgroundInputRef.value?.click()
}

function removePageBackgroundImage(): void {
  store.stopPageBackgroundCropEditing()
  store.updatePageSettings({
    backgroundImageUrl: null,
    backgroundImageCropX: 0,
    backgroundImageCropY: 0,
    backgroundImageScale: 1,
  })
}

function handleStartPageBackgroundCrop(): void {
  store.startPageBackgroundCropEditing()
}

function updatePageBackgroundFit(value: PageBackgroundImageFit): void {
  store.updatePageSettings({ backgroundImageFit: value })
}

async function onPageBackgroundSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  uploadingPageBackgroundImage.value = true

  try {
    const { url } = await uploadAdminImage(file)
    store.updatePageSettings({
      backgroundImageUrl: toStoredAssetPath(url) ?? url,
      backgroundImageCropX: 0,
      backgroundImageCropY: 0,
      backgroundImageScale: 1,
    })
  } catch (error) {
    showErrorMessageModal(getUploadErrorMessage(error), 'Не удалось загрузить фоновое изображение')
  } finally {
    uploadingPageBackgroundImage.value = false
    input.value = ''
  }
}

const isTextBold = computed(() => Boolean(selected.value && isTextPlaceholderElement(selected.value) && selected.value.fontWeight >= 600))
const isTextItalic = computed(() => Boolean(selected.value && isTextPlaceholderElement(selected.value) && selected.value.fontItalic))
const isTextUppercase = computed(
  () => Boolean(selected.value && isTextPlaceholderElement(selected.value) && selected.value.textTransform === 'uppercase'),
)

const LETTER_SPACING_MIN = -2
const LETTER_SPACING_MAX = 20
const LINE_HEIGHT_MIN = 0.5
const LINE_HEIGHT_MAX = 3

const fontOptions = mergedFontOptions
const fitModeOptions = [
  { label: 'Cover', value: 'cover' },
  { label: 'Fill', value: 'fill' },
]

const displayImageUrl = computed(() => resolveAssetUrl(photoElement.value?.defaultImageUrl ?? null) ?? undefined)

const imageInputRef = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)

const photoFrames = ref<AdminPhotoFrame[]>([])
const activePhotoFrames = computed(() => photoFrames.value.filter((item) => item.isActive))

adminPhotoFramesApi
  .list()
  .then((items) => {
    photoFrames.value = items
  })
  .catch(() => {
    photoFrames.value = []
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

function selectTextEffect(card: TextEffectCardDef): void {
  patchElement({ effect: { type: card.type, params: card.defaultParams } as TextEffect })
}

function removeTextEffect(): void {
  patchElement({ effect: null })
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

function isPhotoFilterPresetActive(key: PhotoFilterPresetKey): boolean {
  const filter = photoElement.value?.filter
  return Boolean(filter && filter.preset === key && !isCustomPhotoFilter(filter))
}

function selectPhotoFilter(key: PhotoFilterPresetKey): void {
  const def = getPhotoFilterPresetDef(key)
  patchElement({ filter: { preset: key, intensity: 100, correction: { ...def.correction } } })
}

function removePhotoFilter(): void {
  patchElement({ filter: null })
}

function selectPhotoMask(type: Exclude<PhotoMaskType, 'custom'>): void {
  patchElement({
    mask: { type },
    cropX: 0,
    cropY: 0,
    imageScale: 1,
    imageRotation: 0,
  })
}

function removePhotoMask(): void {
  patchElement({ mask: null })
}

function selectPhotoFrame(item: AdminPhotoFrame): void {
  patchElement({
    frame: {
      imageUrl: item.imageUrl,
      naturalWidth: item.naturalWidth,
      naturalHeight: item.naturalHeight,
      sliceTop: item.sliceTop,
      sliceRight: item.sliceRight,
      sliceBottom: item.sliceBottom,
      sliceLeft: item.sliceLeft,
      photoAreaTop: item.photoAreaTop,
      photoAreaRight: item.photoAreaRight,
      photoAreaBottom: item.photoAreaBottom,
      photoAreaLeft: item.photoAreaLeft,
    },
  })
}

function removePhotoFrame(): void {
  patchElement({ frame: null })
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
    patchElement({
      defaultImageUrl: toStoredAssetPath(url) ?? url,
      cropX: 0,
      cropY: 0,
      imageScale: 1,
    })
  } catch (error) {
    showErrorMessageModal(getUploadErrorMessage(error), 'Не удалось загрузить фото')
  } finally {
    uploadingImage.value = false
    input.value = ''
  }
}

function selectShapeShadow(type: ShapeShadowType): void {
  const def = SHAPE_SHADOW_DESCRIPTORS.find((entry) => entry.type === type)
  if (!def) {
    return
  }
  patchElement({ shadow: { type, params: { ...def.defaultParams } } as ShapeShadow })
}

function removeShapeShadow(): void {
  patchElement({ shadow: null })
}

function selectShapeVisualEffect(def: EffectDescriptor<ShapeVisualEffectType, Record<string, number | string>>): void {
  patchElement({ visualEffect: { type: def.type, params: { ...def.defaultParams } } as ShapeVisualEffect })
}

function removeShapeVisualEffect(): void {
  patchElement({ visualEffect: null })
}

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

const positionLabel = computed(() =>
  selectedSpreadSide.value ? `X / Y (${getSpreadPageSideLabel(selectedSpreadSide.value)})` : 'X / Y',
)

const displayRotation = computed(() => (selected.value ? normalizeElementRotation(selected.value.rotation, 0) : 0))

function updatePosition(axis: 'x' | 'y', value: string | number | null | undefined): void {
  if (!selected.value) {
    return
  }

  if (axis === 'x' && selectedSpreadSide.value) {
    const raw = toNumber(value, displayPositionX.value)
    const next = store.snapToGridEnabled ? store.snapCoordinate(raw) : raw

    patchElement({ position: { x: spreadPageLocalXToGlobal(next, selectedSpreadSide.value) } })
    return
  }

  const raw = toNumber(value, selected.value.position[axis])
  const next = store.snapToGridEnabled ? store.snapCoordinate(raw) : raw

  patchElement({ position: { [axis]: next } })
}

function updateSize(axis: 'width' | 'height', value: string | number | null | undefined): void {
  if (!selected.value) {
    return
  }

  patchElement({ size: { [axis]: toNumber(value, selected.value.size[axis]) } })
}

function updateRotation(value: string | number | null | undefined): void {
  if (!selected.value) {
    return
  }

  patchElement({ rotation: normalizeElementRotation(value, selected.value.rotation ?? 0) })
}

function rotateBy(delta: number): void {
  if (!selected.value || store.previewMode || selected.value.locked) {
    return
  }

  updateRotation(displayRotation.value + delta)
}

function alignToPageCenter(axis: 'horizontal' | 'vertical' | 'both'): void {
  if (!selected.value || store.previewMode || selected.value.locked) {
    return
  }

  store.alignSelectedToPageCenter(axis)
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

  const impactCount = store.getRemovalImpactCount([selected.value.id])
  if (impactCount > 0 && !window.confirm(`Удалить группу и ${impactCount} вложенных объектов?`)) {
    return
  }

  store.removeElement(selected.value.id)
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.mobile-dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: $white;
  border-top: 1px solid pp.$border-strong;
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -4px 20px rgba(13, 13, 13, 0.08);
  max-height: 70vh;
  transition: transform 0.2s ease;
}

.mobile-dock__handle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0 4px;
  touch-action: none;
  cursor: grab;
}

.mobile-dock__handle-bar {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: pp.$border-strong;
}

.mobile-dock__expand {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.22s cubic-bezier(0.4, 0, 0.2, 1);

  &--open {
    max-height: 60vh;
    border-bottom: 1px solid pp.$border;
  }
}

.mobile-dock__scroll {
  max-height: 60vh;
  overflow-y: auto;
  padding: $spacing-4 $spacing-4 $spacing-4;
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.mobile-dock__screen-body {
  padding: $spacing-4 0 0;
}

.mobile-dock__panel-title {
  margin: 0 0 $spacing-1;
  font-size: 10px;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: pp.$ink-faint;
}

.mobile-dock__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mobile-dock__field-label {
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: pp.$ink-soft;
}

.mobile-dock__label-static {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: pp.$ink-soft;
}

.mobile-dock__field input,
.mobile-dock__field textarea {
  width: 100%;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  background: transparent;
  color: pp.$ink;
  font-family: inherit;
  font-size: 16px;
  padding: 14px 14px 12px;
  outline: none;
  min-height: 48px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;

  &:focus {
    border-color: pp.$accent;
    background: pp.$field-hover;
    box-shadow: 0 0 0 3px pp.$accent-glow;
  }
}

.mobile-dock__field textarea {
  min-height: 60px;
  resize: none;
  line-height: 1.5;
}

.mobile-dock__vselect {
  :deep(.v-field) {
    border-radius: pp.$radius;
    min-height: 48px;
  }

  :deep(.v-field__input) {
    min-height: 48px;
    font-size: 15px;
  }
}

.mobile-dock__vselect--compact {
  flex: 0 0 auto;

  :deep(.v-field) {
    min-height: 40px;
  }

  :deep(.v-field__input) {
    min-height: 40px;
    font-size: 13px;
    padding-left: $spacing-2;
  }
}

.mobile-dock__size-row {
  display: flex;
  align-items: center;
  gap: $spacing-2;
}

.mobile-dock__size-box {
  flex: 1;
  position: relative;

  input {
    width: 100%;
    border: 1px solid pp.$border;
    border-radius: pp.$radius;
    background: transparent;
    font-size: 16px;
    padding: 14px 34px 12px 14px;
    outline: none;
    font-family: inherit;
    min-height: 48px;
    color: pp.$ink;

    &:focus {
      border-color: pp.$accent;
      box-shadow: 0 0 0 3px pp.$accent-glow;
    }

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      margin: 0;
      appearance: none;
    }

    appearance: textfield;
    -moz-appearance: textfield;
  }
}

.mobile-dock__unit {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  color: pp.$ink-faint;
}

.mobile-dock__stepper {
  display: flex;
  flex-direction: column;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  overflow: hidden;
  height: 48px;
  flex-shrink: 0;

  button {
    width: 34px;
    flex: 1;
    border: none;
    background: transparent;
    color: pp.$ink-soft;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &:first-child {
      border-bottom: 1px solid pp.$border;
    }

    svg {
      width: 9px;
      height: 9px;
    }
  }
}

.mobile-dock__fmt-row,
.mobile-dock__align-row {
  display: flex;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  overflow: hidden;
  background: transparent;
}

.mobile-dock__fmt-btn,
.mobile-dock__align-btn {
  flex: 1;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-right: 1px solid pp.$border;
  background: transparent;
  color: pp.$ink;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;

  &:last-child {
    border-right: none;
  }

  &.active {
    background: pp.$accent;
    color: $white;
  }

  svg {
    width: 16px;
    height: 16px;
  }
}

.mobile-dock__align-btn {
  color: pp.$ink-soft;
}

.mobile-dock__mini-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
}

.mobile-dock__mini-label {
  font-size: 13px;
  color: pp.$ink-soft;
}

.mobile-dock__mini-num-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mobile-dock__mini-num-field {
  width: 78px;
  height: 40px;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  background: transparent;
  padding: 0 10px;
  font-size: 14px;
  color: pp.$ink;
  outline: none;

  &:focus {
    border-color: pp.$accent;
    box-shadow: 0 0 0 3px pp.$accent-glow;
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    margin: 0;
    appearance: none;
  }

  appearance: textfield;
  -moz-appearance: textfield;
}

.mobile-dock__mini-stepper {
  display: flex;
  flex-direction: column;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  overflow: hidden;
  height: 40px;
  flex-shrink: 0;

  button {
    width: 28px;
    flex: 1;
    border: none;
    background: transparent;
    color: pp.$ink-soft;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &:first-child {
      border-bottom: 1px solid pp.$border;
    }

    svg {
      width: 8px;
      height: 8px;
    }
  }
}

.mobile-dock__mini-seg {
  display: flex;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  overflow: hidden;
  background: transparent;
}

.mobile-dock__mini-seg-btn {
  height: 40px;
  padding: 0 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-right: 1px solid pp.$border;
  background: transparent;
  color: pp.$ink-soft;
  cursor: pointer;

  &:last-child {
    border-right: none;
  }

  &.active {
    background: pp.$accent;
    color: $white;
  }
}

.mobile-dock__setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
}

.mobile-dock__setting-label {
  font-size: 13px;
  color: pp.$ink;
}

.mobile-dock__btn-compact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid pp.$border-strong;
  border-radius: pp.$radius;
  background: transparent;
  color: pp.$ink;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 10px 14px;
  cursor: pointer;
  min-height: 44px;

  svg {
    width: 14px;
    height: 14px;
  }
}

.mobile-dock__default-image-row {
  display: flex;
  align-items: center;
  gap: $spacing-2;
}

.mobile-dock__image-thumb {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 6px;
  border: 1px solid pp.$border;
  overflow: hidden;
  background: repeating-linear-gradient(45deg, pp.$border 0 6px, $white 6px 12px);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.mobile-dock__slider-row {
  display: flex;
  align-items: center;
  gap: $spacing-3;

  :deep(.v-slider-track__fill) {
    background-color: pp.$accent !important;
  }

  :deep(.v-slider-thumb__surface) {
    color: pp.$accent !important;
  }
}

.mobile-dock__vslider {
  flex: 1;
}

.mobile-dock__slider-value {
  width: 56px;
  flex-shrink: 0;
  height: 40px;
  padding: 0 6px;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  background: transparent;
  color: pp.$ink;
  font-size: 13px;
  text-align: center;
  outline: none;

  &:focus {
    border-color: pp.$accent;
    box-shadow: 0 0 0 3px pp.$accent-glow;
  }
}

.mobile-dock__fx-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  margin: 0 -#{$spacing-4} 0;
  padding: 2px $spacing-4 4px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.mobile-dock__fx-item {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  width: 58px;
  min-width: 0;
}

.mobile-dock__fx-thumb {
  width: 58px;
  height: 58px;
  border-radius: 10px;
  border: 1.5px solid pp.$border;
  background: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: pp.$font-display;
  font-weight: 700;
  font-size: 19px;
  color: pp.$ink;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.mobile-dock__fx-item--frame .mobile-dock__fx-thumb,
.mobile-dock__fx-thumb--frame {
  width: 84px;
  height: 84px;
  border-radius: 8px;

  img {
    object-fit: contain;
  }
}

.mobile-dock__fx-item--frame {
  width: 84px;
}

.mobile-dock__fx-item.active .mobile-dock__fx-thumb {
  border-color: pp.$accent;
  border-width: 2px;
}

.mobile-dock__fx-label {
  font-size: 9px;
  color: pp.$ink-soft;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.mobile-dock__fx-item.active .mobile-dock__fx-label {
  color: pp.$accent-deep;
  font-weight: 600;
}

.mobile-dock__fx-swatch {
  width: 60%;
  height: 60%;
  border-radius: 6px;
}

.mobile-dock__fx-more {
  align-self: flex-end;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  padding: 0;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: pp.$ink-soft;
  cursor: pointer;
}

.mobile-dock__toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
}

.mobile-dock__toggle-label {
  font-size: 14px;
  color: pp.$ink;
}

.mobile-dock__align-canvas-row {
  display: flex;
  gap: 10px;
}

.mobile-dock__align-canvas-btn {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 1px solid pp.$border;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: pp.$ink;
  cursor: pointer;

  svg {
    width: 20px;
    height: 20px;
  }

  &--sm {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
  }
}

.mobile-dock__chip-strip {
  flex-shrink: 0;
  display: flex;
  gap: 2px;
  overflow-x: auto;
  padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 8px));
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.mobile-dock__chip {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  border-radius: 12px;
  color: pp.$ink-soft;
  border: none;
  background: none;
  cursor: pointer;

  span {
    font-size: 9.5px;
    font-weight: 500;
    white-space: nowrap;
  }

  &.active {
    color: pp.$accent-deep;
    background: pp.$accent-tint;
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.mobile-dock__chip--danger:active {
  color: #b23b54;
}

.mobile-dock__chip-sep {
  width: 1px;
  flex: 0 0 auto;
  background: pp.$border;
  margin: 8px 6px;
  align-self: stretch;
}
</style>
