<template>

  <aside class="editor-properties" aria-label="Свойства элемента">

    <!-- objectBoundingBox clip works at any thumbnail pixel size — needed for the heart mask
         preview in the "Маска" strip below, which can't be expressed as a native CSS basic-shape
         function. EditorPhotoMaskScreen.vue defines the same id for its own full-grid screen;
         the two are never mounted at the same time (root strip vs. pushed screen), so there's no
         duplicate-id conflict. -->
    <svg width="0" height="0" style="position: absolute">
      <defs>
        <clipPath id="photo-mask-heart-clip" clipPathUnits="objectBoundingBox">
          <path
            d="M 0.5 0.85 C 0.2 0.65, 0 0.45, 0 0.25 C 0 0.05, 0.25 -0.05, 0.5 0.15 C 0.75 -0.05, 1 0.05, 1 0.25 C 1 0.45, 0.8 0.65, 0.5 0.85 Z"
          />
        </clipPath>
      </defs>
    </svg>

    <div v-if="panelStack.isRoot.value" class="editor-properties__header">

      <div class="editor-properties__header-text">

        <p class="editor-properties__eyebrow">Свойства</p>

        <h2 class="editor-properties__title">

          {{ panelTitle }}

        </h2>

      </div>

      <v-btn
        icon
        size="x-small"
        variant="text"
        class="editor-properties__close"
        aria-label="Закрыть панель свойств"
        @click="store.closePropertiesPanel()"
      >
        <v-icon size="18">mdi-close</v-icon>
      </v-btn>

    </div>

    <PropertiesPanelScreenHeader
      v-else
      :title="panelStack.current.value.title ?? ''"
      @back="panelStack.pop"
    />

    <div class="editor-properties__body">

      <div class="editor-properties__screen-viewport">
        <Transition :name="panelStack.direction.value === 'forward' ? 'panel-slide-forward' : 'panel-slide-back'">
          <div :key="panelStack.current.value.id" class="editor-properties__screen">
            <template v-if="panelStack.isRoot.value">

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



        <div v-if="store.isSpreadPage" class="editor-properties__spread-bg">
          <div class="editor-properties__spread-bg-mode" role="group" aria-label="Режим фона разворота">
            <button
              v-for="option in spreadBackgroundModeOptions"
              :key="option.value"
              type="button"
              class="editor-properties__spread-bg-mode-btn"
              :class="{
                'editor-properties__spread-bg-mode-btn--active':
                  store.spreadBackgroundMode === option.value,
              }"
              :title="option.title"
              :aria-pressed="store.spreadBackgroundMode === option.value"
              @click="updateSpreadBackgroundMode(option.value)"
            >
              <v-icon size="16">{{ option.icon }}</v-icon>
              <span>{{ option.shortTitle }}</span>
            </button>
          </div>

          <div
            v-if="store.spreadBackgroundMode === 'per-page'"
            class="editor-properties__spread-bg-pages"
            role="tablist"
            aria-label="Страница для редактирования фона"
          >
            <button
              v-for="option in spreadBackgroundSideOptions"
              :key="option.value"
              type="button"
              role="tab"
              class="editor-properties__spread-bg-page"
              :class="{
                'editor-properties__spread-bg-page--active':
                  store.activeSpreadBackgroundSide === option.value,
              }"
              :title="option.title"
              :aria-selected="store.activeSpreadBackgroundSide === option.value"
              @click="updateActiveSpreadBackgroundSide(option.value)"
            >
              <span
                class="editor-properties__spread-bg-page-preview"
                :style="getSpreadPagePreviewStyle(option.value)"
              />
              <span class="editor-properties__spread-bg-page-label">{{ option.shortTitle }}</span>
            </button>
          </div>

          <p v-else class="editor-properties__spread-bg-hint">
            Один фон на обе страницы
          </p>
        </div>



        <EditorColorPicker
          :model-value="editablePageBackground.backgroundColor"
          label="Цвет фона"
          fallback="#FFFFFF"
          @update:model-value="updateBackgroundColor"
        />

        <div v-if="editablePageBackground.backgroundImageUrl" class="editor-properties__image-preview">
          <img :src="pageBackgroundImagePreviewUrl" alt="Фоновое изображение страницы" />

          <v-btn
            size="small"
            variant="text"
            color="error"
            @click="removePageBackgroundImage"
          >
            Удалить
          </v-btn>
        </div>

        <v-btn
          variant="outlined"
          size="small"
          prepend-icon="mdi-image-plus-outline"
          :loading="uploadingPageBackgroundImage"
          @click="triggerPageBackgroundInput"
        >
          {{ editablePageBackground.backgroundImageUrl ? 'Заменить изображение' : 'Загрузить изображение' }}
        </v-btn>

        <input
          ref="pageBackgroundInputRef"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          @change="onPageBackgroundSelected"
        />

        <v-btn
          v-if="editablePageBackground.backgroundImageUrl"
          variant="outlined"
          size="small"
          prepend-icon="mdi-crop"
          :disabled="store.previewMode"
          @click="handleStartPageBackgroundCrop"
        >
          Кадрировать
        </v-btn>

        <v-select
          v-if="editablePageBackground.backgroundImageUrl"
          :model-value="editablePageBackground.backgroundImageFit"
          :items="pageBackgroundFitOptions"
          item-title="title"
          item-value="value"
          label="Масштабирование"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="updatePageBackgroundFit"
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
              rounded="circle"
              size="small"
              variant="outlined"
              title="По левому краю"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
              @click="alignMulti('left')"
            >
              <v-icon size="20">mdi-format-horizontal-align-left</v-icon>
            </v-btn>
            <v-btn
              icon
              rounded="circle"
              size="small"
              variant="outlined"
              title="По верхнему краю"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
              @click="alignMulti('top')"
            >
              <v-icon size="20">mdi-format-vertical-align-top</v-icon>
            </v-btn>
            <v-btn
              icon
              rounded="circle"
              size="small"
              variant="outlined"
              title="По центру по горизонтали"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
              @click="alignMulti('center-horizontal')"
            >
              <v-icon size="20">mdi-format-horizontal-align-center</v-icon>
            </v-btn>
            <v-btn
              icon
              rounded="circle"
              size="small"
              variant="outlined"
              title="По центру по вертикали"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
              @click="alignMulti('center-vertical')"
            >
              <v-icon size="20">mdi-format-vertical-align-center</v-icon>
            </v-btn>
          </div>

          <div class="editor-properties__align-row">
            <v-btn
              icon
              rounded="circle"
              size="small"
              variant="outlined"
              title="Распределить по горизонтали (3+)"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 3"
              @click="alignMulti('distribute-horizontal')"
            >
              <v-icon size="20">mdi-distribute-horizontal-center</v-icon>
            </v-btn>
            <v-btn
              icon
              rounded="circle"
              size="small"
              variant="outlined"
              title="Распределить по вертикали (3+)"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 3"
              @click="alignMulti('distribute-vertical')"
            >
              <v-icon size="20">mdi-distribute-vertical-center</v-icon>
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

        <EditorPositionFields v-if="!isTextElement" />

        <div v-if="isTextElement" class="editor-properties__section">

          <p class="editor-properties__section-title">Контент</p>

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

        </div>

        <div v-if="isTextElement" class="editor-properties__section">

          <p class="editor-properties__section-title">Типографика</p>



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



          <EditorStepperField

            :model-value="textElement.fontSize"

            label="Размер"

            suffix="px"

            :min="1"

            @update:model-value="patchElement({ fontSize: $event })"

          />



          <p class="editor-properties__field-label">Начертание</p>

          <div class="editor-properties__typo-group editor-properties__typo-group--stretch">

              <v-btn

                :variant="isTextBold ? 'flat' : 'text'"

                :color="isTextBold ? 'primary' : undefined"

                size="small"

                class="editor-properties__style-btn"

                rounded="0"

                title="Жирный"

                @click="toggleBold"

              >

                <span class="editor-properties__style-icon editor-properties__style-icon--bold">B</span>

              </v-btn>

              <v-btn

                :variant="isTextItalic ? 'flat' : 'text'"

                :color="isTextItalic ? 'primary' : undefined"

                size="small"

                class="editor-properties__style-btn"

                rounded="0"

                title="Курсив"

                @click="toggleItalic"

              >

                <span class="editor-properties__style-icon editor-properties__style-icon--italic">I</span>

              </v-btn>

              <v-btn

                :variant="isTextUppercase ? 'flat' : 'text'"

                :color="isTextUppercase ? 'primary' : undefined"

                size="small"

                class="editor-properties__style-btn"

                rounded="0"

                title="Все заглавные"

                @click="toggleUppercase"

              >

                <span class="editor-properties__style-icon">Aa</span>

              </v-btn>

          </div>

          <p class="editor-properties__field-label editor-properties__field-label--spaced">Выравнивание текста</p>

          <div class="editor-properties__typo-toolbar">

            <div class="editor-properties__typo-group editor-properties__typo-group--stretch editor-properties__typo-group--fill">

              <v-btn

                :variant="textElement.textAlign === 'left' ? 'flat' : 'text'"

                :color="textElement.textAlign === 'left' ? 'primary' : undefined"

                size="small"

                class="editor-properties__style-btn"

                rounded="0"

                title="Слева"

                @click="setTextAlign('left')"

              >

                <svg class="editor-properties__align-text-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M4 6h16M4 12h10M4 18h13" />
                </svg>

              </v-btn>

              <v-btn

                :variant="textElement.textAlign === 'center' ? 'flat' : 'text'"

                :color="textElement.textAlign === 'center' ? 'primary' : undefined"

                size="small"

                class="editor-properties__style-btn"

                rounded="0"

                title="По центру"

                @click="setTextAlign('center')"

              >

                <svg class="editor-properties__align-text-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M4 6h16M7 12h10M5.5 18h13" />
                </svg>

              </v-btn>

              <v-btn

                :variant="textElement.textAlign === 'right' ? 'flat' : 'text'"

                :color="textElement.textAlign === 'right' ? 'primary' : undefined"

                size="small"

                class="editor-properties__style-btn"

                rounded="0"

                title="Справа"

                @click="setTextAlign('right')"

              >

                <svg class="editor-properties__align-text-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M4 6h16M10 12h10M7 18h13" />
                </svg>

              </v-btn>

              <v-btn

                :variant="textElement.textAlign === 'justify' ? 'flat' : 'text'"

                :color="textElement.textAlign === 'justify' ? 'primary' : undefined"

                size="small"

                class="editor-properties__style-btn"

                rounded="0"

                title="По ширине"

                @click="setTextAlign('justify')"

              >

                <svg class="editor-properties__align-text-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>

              </v-btn>

            </div>



            <div class="editor-properties__typo-group">

              <v-menu

                v-model="textSpacingMenuOpen"

                :close-on-content-click="false"

                location="bottom start"

                offset="8"

              >

              <template #activator="{ props: menuProps }">

                <v-btn

                  v-bind="menuProps"

                  :variant="textSpacingMenuOpen || hasAdvancedTextSpacing ? 'flat' : 'text'"

                  :color="textSpacingMenuOpen || hasAdvancedTextSpacing ? 'primary' : undefined"

                  size="small"

                  class="editor-properties__style-btn"

                rounded="0"

                  icon="mdi-format-line-spacing"

                  title="Интервалы и выравнивание"

                />

              </template>



              <v-card class="editor-properties__spacing-menu" min-width="280">

                <div class="editor-properties__spacing-row">

                  <span class="editor-properties__spacing-label">Межбуквенный интервал</span>

                  <EditorStepperField

                    size="mini"

                    :model-value="textElement.letterSpacing"

                    :min="LETTER_SPACING_MIN"

                    :max="LETTER_SPACING_MAX"

                    :step="0.1"

                    class="editor-properties__spacing-input"

                    @update:model-value="patchElement({ letterSpacing: $event })"

                  />

                </div>



                <div class="editor-properties__spacing-row">

                  <span class="editor-properties__spacing-label">Расстояние между строками</span>

                  <EditorStepperField

                    size="mini"

                    :model-value="textElement.lineHeight"

                    :min="LINE_HEIGHT_MIN"

                    :max="LINE_HEIGHT_MAX"

                    :step="0.05"

                    class="editor-properties__spacing-input"

                    @update:model-value="patchElement({ lineHeight: $event })"

                  />

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

          </div>

        </div>

        <div v-if="isTextElement" class="editor-properties__section">

          <p class="editor-properties__section-title">Цвет</p>

          <EditorColorPicker
            :model-value="textElement.color"
            label="Цвет текста"
            fallback="#111111"
            @update:model-value="patchElement({ color: $event })"
          />

        </div>

        <div v-if="isTextElement" class="editor-properties__section">

          <p class="editor-properties__section-title">Поведение</p>

          <EditorSwitch

            :model-value="textElement.required"

            label="Обязательное поле"

            @update:model-value="patchElement({ required: $event })"

          />

        </div>

        <div v-if="isTextElement" class="editor-properties__section">

          <p class="editor-properties__section-title">Эффекты</p>

          <div class="editor-properties__fx-scroll">

            <button
              type="button"
              class="editor-properties__fx-item"
              :class="{ 'editor-properties__fx-item--active': !textElement.effect }"
              @click="removeTextEffect"
            >
              <span class="editor-properties__fx-thumb">Аа</span>
              <span class="editor-properties__fx-label">Без эффекта</span>
            </button>

            <button
              v-for="card in TEXT_EFFECT_CARDS"
              :key="card.type"
              type="button"
              class="editor-properties__fx-item"
              :class="{ 'editor-properties__fx-item--active': textElement.effect?.type === card.type }"
              @click="selectTextEffect(card)"
            >
              <span class="editor-properties__fx-thumb" :style="getTextEffectDemoStyle(card.type)">Аа</span>
              <span class="editor-properties__fx-label">{{ card.label }}</span>
            </button>

          </div>

          <button
            type="button"
            class="editor-properties__fx-more"
            @click="panelStack.push({ id: 'text-effects', title: 'Эффекты' })"
          >
            Все эффекты
            <v-icon size="12">mdi-chevron-right</v-icon>
          </button>

        </div>

        <EditorPositionFields v-if="isTextElement" />

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

          <v-btn
            v-if="photoElement.defaultImageUrl"
            variant="outlined"
            size="small"
            prepend-icon="mdi-image-edit-outline"
            :disabled="store.previewMode"
            @click="store.startPhotoDim(selected.id)"
          >
            Редактировать
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

          <EditorPhotoFrameField :frame="photoElement.frame" @patch="patchElement" />

          <EditorBorderFields
            v-if="!photoElement.frame"
            :stroke="photoElement.stroke"
            :stroke-width="photoElement.strokeWidth"
            :stroke-style="photoElement.strokeStyle"
            :stroke-position="photoElement.strokePosition"
            @patch="patchElement"
          />



          <EditorSwitch

            :model-value="photoElement.required"

            label="Обязательное поле"

            @update:model-value="patchElement({ required: $event })"

          />



        </div>

        <div v-if="isPhotoElement" class="editor-properties__section">

          <p class="editor-properties__section-title">Фильтры</p>

          <div class="editor-properties__fx-scroll">

            <button
              type="button"
              class="editor-properties__fx-item"
              :class="{ 'editor-properties__fx-item--active': !photoElement.filter }"
              @click="removePhotoFilter"
            >
              <span class="editor-properties__fx-thumb">
                <img v-if="displayImageUrl" :src="displayImageUrl" alt="" />
                <v-icon v-else size="20" color="textMuted">mdi-image-outline</v-icon>
              </span>
              <span class="editor-properties__fx-label">Без фильтра</span>
            </button>

            <button
              v-for="preset in PHOTO_FILTER_PRESETS"
              :key="preset.key"
              type="button"
              class="editor-properties__fx-item"
              :class="{ 'editor-properties__fx-item--active': isPhotoFilterPresetActive(preset.key) }"
              @click="selectPhotoFilter(preset.key)"
            >
              <span class="editor-properties__fx-thumb">
                <img v-if="displayImageUrl" :src="displayImageUrl" alt="" :style="{ filter: getCssFilterPreview(preset.correction) }" />
                <v-icon v-else size="20" color="textMuted">mdi-image-outline</v-icon>
              </span>
              <span class="editor-properties__fx-label">{{ preset.label }}</span>
            </button>

          </div>

          <button
            type="button"
            class="editor-properties__fx-more"
            @click="panelStack.push({ id: 'photo-filters', title: 'Фильтры' })"
          >
            Все фильтры
            <v-icon size="12">mdi-chevron-right</v-icon>
          </button>

        </div>

        <div v-if="isPhotoElement" class="editor-properties__section">

          <p class="editor-properties__section-title">Маска</p>

          <div class="editor-properties__fx-scroll">

            <button
              type="button"
              class="editor-properties__fx-item"
              :class="{ 'editor-properties__fx-item--active': !photoElement.mask }"
              @click="removePhotoMask"
            >
              <span class="editor-properties__fx-thumb">
                <img v-if="displayImageUrl" :src="displayImageUrl" alt="" />
                <v-icon v-else size="20" color="textMuted">mdi-image-outline</v-icon>
              </span>
              <span class="editor-properties__fx-label">Без маски</span>
            </button>

            <button
              v-for="def in PHOTO_MASK_DESCRIPTORS"
              :key="def.type"
              type="button"
              class="editor-properties__fx-item"
              :class="{ 'editor-properties__fx-item--active': photoElement.mask?.type === def.type }"
              @click="selectPhotoMask(def.type)"
            >
              <span class="editor-properties__fx-thumb">
                <img v-if="displayImageUrl" :src="displayImageUrl" alt="" :style="{ clipPath: def.cssClipPath }" />
                <v-icon v-else size="20" color="textMuted">mdi-image-outline</v-icon>
              </span>
              <span class="editor-properties__fx-label">{{ def.label }}</span>
            </button>

          </div>

          <button
            type="button"
            class="editor-properties__fx-more"
            @click="panelStack.push({ id: 'photo-mask', title: 'Маска' })"
          >
            Все маски
            <v-icon size="12">mdi-chevron-right</v-icon>
          </button>

        </div>



        <div v-if="isShapeElement" class="editor-properties__section">

          <p class="editor-properties__section-title">{{ isLineElement ? 'Линия' : 'Фигура' }}</p>

          <EditorShapeStrokeFields
            :element="shapeElement"
            :show-fill="!isLineElement"
            :show-corner-radius="isRectangleElement"
            :optional-stroke="!isLineElement"
            :stroke-width-label="isLineElement ? 'Толщина' : 'Толщина'"
            @patch="(patch) => patchElement(patch as ElementPatch)"
          />

        </div>

        <div v-if="isShapeElement" class="editor-properties__section">

          <p class="editor-properties__section-title">Тени</p>

          <div class="editor-properties__fx-scroll">

            <button
              type="button"
              class="editor-properties__fx-item"
              :class="{ 'editor-properties__fx-item--active': !shapeElement.shadow }"
              @click="removeShapeShadow"
            >
              <span class="editor-properties__fx-thumb">
                <v-icon size="22" color="textMuted">mdi-square-off-outline</v-icon>
              </span>
              <span class="editor-properties__fx-label">Без тени</span>
            </button>

            <button
              v-for="def in SHAPE_SHADOW_DESCRIPTORS"
              :key="def.type"
              type="button"
              class="editor-properties__fx-item"
              :class="{ 'editor-properties__fx-item--active': shapeElement.shadow?.type === def.type }"
              @click="selectShapeShadow(def.type)"
            >
              <span class="editor-properties__fx-thumb">
                <v-icon size="22">{{ SHAPE_SHADOW_ICONS[def.type] }}</v-icon>
              </span>
              <span class="editor-properties__fx-label">{{ def.label }}</span>
            </button>

          </div>

          <button
            type="button"
            class="editor-properties__fx-more"
            @click="panelStack.push({ id: 'shape-shadow', title: 'Тени' })"
          >
            Все тени
            <v-icon size="12">mdi-chevron-right</v-icon>
          </button>

        </div>

        <div v-if="isShapeElement" class="editor-properties__section">

          <p class="editor-properties__section-title">Эффекты</p>

          <div class="editor-properties__fx-scroll">

            <button
              type="button"
              class="editor-properties__fx-item"
              :class="{ 'editor-properties__fx-item--active': !shapeElement.visualEffect }"
              @click="removeShapeVisualEffect"
            >
              <span class="editor-properties__fx-thumb">
                <span class="editor-properties__fx-swatch" :style="{ background: shapeElement.fill || '#E3DDD5' }" />
              </span>
              <span class="editor-properties__fx-label">Без эффекта</span>
            </button>

            <button
              v-for="def in SHAPE_VISUAL_EFFECT_DESCRIPTORS"
              :key="def.type"
              type="button"
              class="editor-properties__fx-item"
              :class="{ 'editor-properties__fx-item--active': shapeElement.visualEffect?.type === def.type }"
              @click="selectShapeVisualEffect(def)"
            >
              <span class="editor-properties__fx-thumb">
                <span
                  class="editor-properties__fx-swatch"
                  :style="getShapeVisualEffectPreviewStyle(def.type, shapeElement.fill || '#E3DDD5')"
                />
              </span>
              <span class="editor-properties__fx-label">{{ def.label }}</span>
            </button>

          </div>

          <button
            type="button"
            class="editor-properties__fx-more"
            @click="panelStack.push({ id: 'shape-visual-effect', title: 'Эффекты' })"
          >
            Все эффекты
            <v-icon size="12">mdi-chevron-right</v-icon>
          </button>

        </div>



        <div class="editor-properties__section">

          <p class="editor-properties__section-title">Элемент</p>

          <p class="editor-properties__meta">Тип: {{ selected.type }}</p>

        </div>

      </template>



      <div v-else class="editor-properties__hint">

        <v-icon size="28" color="textMuted">mdi-cursor-default-outline</v-icon>

        <p>Выберите элемент на странице или настройте параметры страницы выше.</p>

      </div>

            </template>
            <component :is="panelScreenComponent" v-else-if="panelScreenComponent" />
          </div>
        </Transition>
      </div>

    </div>

    <footer
      v-if="panelStack.isRoot.value && selected && !store.isMultiSelection"
      class="editor-properties__footer"
    >
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

      <v-tooltip location="top" content-class="editor-properties__delete-tooltip">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon
            variant="outlined"
            size="small"
            class="editor-properties__delete"
            aria-label="Удалить"
            :disabled="store.previewMode"
            @click="handleRemove"
          >
            <v-icon size="18">mdi-delete-outline</v-icon>
          </v-btn>
        </template>
        Удалить
      </v-tooltip>
    </footer>

  </aside>

</template>



<script setup lang="ts">

import { computed, provide, ref, watch } from 'vue'

import { storeToRefs } from 'pinia'

import { usePropertiesPanelStack } from '../composables/use-properties-panel-stack'
import { PROPERTIES_PANEL_STACK_KEY } from '../composables/properties-panel-stack.context'
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



import { uploadAdminImage } from '@/shared/api/admin/uploads.api'

import { resolveAssetUrl, toStoredAssetPath } from '@/shared/config/assets'
import { useErrorMessageModal } from '@/shared/composables/useErrorMessageModal'
import { getUploadErrorMessage } from '@/shared/utils/api-error.util'

import {

  PAGE_SIZE_PRESETS,

} from '../constants/page.constants'

import { mergedFontOptions } from '../utils/custom-fonts.util'

import type { ElementPatch } from '../store/editor.store'

import { useEditorStore } from '../store/editor.store'
import {
  PAGE_BACKGROUND_IMAGE_FIT_OPTIONS,
  SPREAD_BACKGROUND_MODE_OPTIONS,
  SPREAD_BACKGROUND_SIDE_OPTIONS,
} from '../models/page-background.model'
import type { PageBackgroundImageFit, SpreadBackgroundMode, SpreadBackgroundSide } from '../models/page-background.model'
import EditorShapeStrokeFields from './EditorShapeStrokeFields.vue'
import EditorColorPicker from './EditorColorPicker.vue'
import EditorBorderFields from './EditorBorderFields.vue'
import EditorPhotoFrameField from './EditorPhotoFrameField.vue'
import EditorStepperField from './EditorStepperField.vue'
import EditorSwitch from './EditorSwitch.vue'
import EditorPositionFields from './EditorPositionFields.vue'

import type { MultiAlignMode } from '../utils/align-elements.util'
import {
  getAverageHorizontalGap,
  getAverageVerticalGap,
} from '../utils/align-elements.util'

import {
  isPhotoPlaceholderElement,

  isTextPlaceholderElement,

} from '../utils/placeholder-display.util'



const store = useEditorStore()
const { showErrorMessageModal } = useErrorMessageModal()

const { selectedElement: selected } = storeToRefs(store)

const panelStack = usePropertiesPanelStack(() => ({ id: 'root' }))

provide(PROPERTIES_PANEL_STACK_KEY, {
  push: panelStack.push,
  pop: panelStack.pop,
  isRoot: panelStack.isRoot,
})

watch(
  () => selected.value?.id,
  () => panelStack.reset({ id: 'root' }),
)

const panelScreenComponent = computed(() =>
  panelStack.isRoot.value ? null : PANEL_SCREENS[panelStack.current.value.id as PanelScreenId],
)


const imageInputRef = ref<HTMLInputElement | null>(null)

const uploadingImage = ref(false)

const pageBackgroundInputRef = ref<HTMLInputElement | null>(null)

const uploadingPageBackgroundImage = ref(false)

const pageBackgroundFitOptions = PAGE_BACKGROUND_IMAGE_FIT_OPTIONS
const spreadBackgroundModeOptions = SPREAD_BACKGROUND_MODE_OPTIONS
const spreadBackgroundSideOptions = SPREAD_BACKGROUND_SIDE_OPTIONS

const editablePageBackground = computed(() => store.editablePageBackground)

function getSpreadPagePreviewStyle(side: SpreadBackgroundSide): Record<string, string> {
  const settings = side === 'left' ? store.leftPageBackground : store.rightPageBackground
  const styles: Record<string, string> = {
    backgroundColor: settings.backgroundColor,
  }

  if (settings.backgroundImageUrl) {
    const url = resolveAssetUrl(settings.backgroundImageUrl)

    if (url) {
      styles.backgroundImage = `url("${url}")`
      styles.backgroundSize = 'cover'
      styles.backgroundPosition = 'center'
    }
  }

  return styles
}

const pageBackgroundImagePreviewUrl = computed(
  () => resolveAssetUrl(editablePageBackground.value.backgroundImageUrl) ?? '',
)

const horizontalGapDraft = ref('')
const verticalGapDraft = ref('')
const horizontalGapFocused = ref(false)
const verticalGapFocused = ref(false)

const textSpacingMenuOpen = ref(false)

const LETTER_SPACING_MIN = -2
const LETTER_SPACING_MAX = 20
const LINE_HEIGHT_MIN = 0.5
const LINE_HEIGHT_MAX = 3



const fontOptions = mergedFontOptions

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

const isShapeElement = computed(

  () =>

    selected.value?.type === 'shape-rectangle' ||

    selected.value?.type === 'shape-circle' ||

    selected.value?.type === 'shape-line',

)

const isLineElement = computed(() => selected.value?.type === 'shape-line')

const isRectangleElement = computed(() => selected.value?.type === 'shape-rectangle')



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



function selectTextEffect(card: TextEffectCardDef): void {
  patchElement({ effect: { type: card.type, params: card.defaultParams } as TextEffect })
}

function removeTextEffect(): void {
  patchElement({ effect: null })
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



function updatePageSize(axis: 'width' | 'height', value: string | number | null | undefined): void {

  store.updatePageSettings({

    [axis]: toNumber(value, axis === 'width' ? store.pageWidth : store.pageHeight),

  })

}



function updateSpreadBackgroundMode(value: SpreadBackgroundMode): void {
  store.setSpreadBackgroundMode(value)
}

function updateActiveSpreadBackgroundSide(value: SpreadBackgroundSide): void {
  store.setActiveSpreadBackgroundSide(value)
}

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
    showErrorMessageModal(
      getUploadErrorMessage(error),
      'Не удалось загрузить фоновое изображение',
    )
  } finally {
    uploadingPageBackgroundImage.value = false
    input.value = ''
  }
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

    patchElement({
      defaultImageUrl: toStoredAssetPath(url) ?? url,
      cropX: 0,
      cropY: 0,
      imageScale: 1,
    })

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

  const impactCount = store.getRemovalImpactCount([selected.value.id])
  if (impactCount > 0 && !window.confirm(`Удалить группу и ${impactCount} вложенных объектов?`)) {
    return
  }

  store.removeElement(selected.value.id)
}

</script>



<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-properties {

  display: flex;

  flex-direction: column;

  // Margin (instead of height: 100%) so CSS Grid's default stretch sizing accounts for it,
  // leaving the rounded corners/shadow visible on every side — reads as a floating window rather
  // than a flush panel.
  margin: $spacing-3;

  border: 1px solid pp.$border-strong;

  border-radius: $radius-md;

  background: $white;

  box-shadow: $shadow-sm;

  overflow: hidden;

  // Retheme accent for every Vuetify component rendered inside the panel (buttons, switches,
  // sliders, badges that use bg-primary/text-primary utility classes) — these read the
  // --v-theme-primary CSS variable at render time, so redeclaring it here repaints them pink
  // without touching the global theme (src/styles/theme.ts) used by the rest of the app. This
  // also cascades into the pushed sub-screens (EditorEffectsScreen, EditorPhotoFiltersScreen,
  // etc.) since they mount as DOM descendants of this element.
  --v-theme-primary: #{pp.$accent-rgb};

  :deep(.v-field) {
    border-radius: pp.$radius;
  }

  :deep(.v-field__outline) {
    color: pp.$border;
  }

  :deep(.v-field:hover .v-field__outline) {
    color: pp.$border-strong;
  }

  :deep(.v-field--focused .v-field__outline) {
    color: pp.$accent;
  }

  :deep(.v-field--focused .v-label.v-field-label) {
    color: pp.$accent-deep;
  }

  // Note: unlike .v-field (below), VBtn's shape comes from Vuetify's rounded-* utility classes
  // (rounded-lg, rounded-circle, rounded-0…), which are declared with !important — a plain CSS
  // border-radius override here cannot win against them. Buttons that need a specific shape use
  // the `rounded` prop directly in the template instead (see the alignment buttons and the
  // formatting/text-align button groups).

}



.editor-properties__header {

  display: flex;

  align-items: flex-start;

  justify-content: space-between;

  gap: $spacing-2;

  padding: $spacing-6 $spacing-4 $spacing-4;

  border-bottom: 1px solid $border-light;

}



.editor-properties__close {

  flex-shrink: 0;

  margin-top: -$spacing-1;

  margin-right: -$spacing-1;

}



.editor-properties__eyebrow {

  margin: 0 0 $spacing-1;

  font-size: $font-size-caption;

  letter-spacing: 0.14em;

  text-transform: uppercase;

  color: pp.$ink-soft;

}



.editor-properties__title {

  margin: 0;

  font-family: pp.$font-display;

  font-size: $font-size-h4;

  font-weight: $font-weight-bold;

  letter-spacing: -0.01em;

  color: pp.$ink;

}



.editor-properties__body {

  display: flex;

  flex-direction: column;

  overflow-y: auto;

}

.editor-properties__screen-viewport {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  overflow-x: hidden;
}

.editor-properties__screen {
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding: $spacing-4;
}

.panel-slide-forward-enter-active,
.panel-slide-forward-leave-active,
.panel-slide-back-enter-active,
.panel-slide-back-leave-active {
  transition:
    transform 250ms $ease-out-editorial,
    opacity 250ms $ease-out-editorial;
}

.panel-slide-forward-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.panel-slide-forward-leave-to {
  transform: translateX(-30%);
  opacity: 0;
}

.panel-slide-back-enter-from {
  transform: translateX(-30%);
  opacity: 0;
}

.panel-slide-back-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.editor-properties__row-link {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  width: 100%;
  padding: $spacing-3 0;
  border: none;
  border-top: 1px solid pp.$border;
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: pp.$ink;
  text-align: left;
  transition: color 0.12s ease;

  &:hover {
    background: pp.$field-hover;
    color: pp.$accent-deep;
  }

  &:hover .editor-properties__row-link-chevron {
    color: pp.$accent-deep;
  }
}

.editor-properties__row-link-label {
  flex-shrink: 0;
}

.editor-properties__row-link-preview {
  flex: 1;
  min-width: 0;
  text-align: right;
  color: pp.$ink-faint;
  font-size: $font-size-body-sm;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-properties__row-link-chevron {
  color: pp.$ink-soft;
  transition: color 0.12s ease;
}

// Horizontal-scroll strip of live-preview effect thumbnails, bleeding past the panel's own
// padding so cards can peek off the edge — matches the mockup's .fx-scroll treatment. "Все
// эффекты" below opens the full grid screen (also where per-effect params are tuned).
.editor-properties__fx-scroll {
  $bleed: $spacing-4 * -1;

  display: flex;
  gap: $spacing-2;
  overflow-x: auto;
  margin: 0 $bleed $spacing-2 $bleed;
  padding: 2px $spacing-4 $spacing-1;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.editor-properties__fx-item {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  // Fixed to the thumb's own width — without this, a long label (e.g. "Скругленный
  // прямоугольник") stretches the whole card to fit on one line, opening a big gap around its
  // (still 52px) thumb relative to its neighbors.
  width: 52px;
  // Flex items default to min-width: auto, which keeps them from shrinking below their longest
  // unbreakable word — without this, a single long word (e.g. "Скругленный") still overflows the
  // 52px card and overlaps its neighbor even though the label wraps everywhere else it can.
  min-width: 0;
  gap: $spacing-1;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.editor-properties__fx-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border: 1.5px solid pp.$border;
  border-radius: $radius-sm;
  background: $white;
  overflow: hidden;
  font-family: pp.$font-display;
  font-weight: $font-weight-bold;
  font-size: 17px;
  color: pp.$ink;
  transition: border-color 0.12s ease;

  // Photo filter/mask fx-items put a real <img> here (text/shape effects use a text glyph or
  // color swatch instead) — without this it renders at its natural aspect ratio and overflows
  // the 52px square, pushing the label out of the compact card layout.
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .editor-properties__fx-item:hover & {
    border-color: pp.$border-strong;
  }

  .editor-properties__fx-item:focus-visible & {
    box-shadow: 0 0 0 3px pp.$accent-glow;
  }
}

.editor-properties__fx-item--active .editor-properties__fx-thumb {
  border-color: pp.$accent;
  border-width: 2px;
}

.editor-properties__fx-label {
  width: 100%;
  font-size: 9px;
  font-weight: 500;
  color: pp.$ink-soft;
  line-height: 1.25;
  text-align: center;
  overflow-wrap: break-word;
  word-break: break-word;
}

.editor-properties__fx-item--active .editor-properties__fx-label {
  color: pp.$accent-deep;
  font-weight: $font-weight-semibold;
}

.editor-properties__fx-more {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: flex-start;
  border: none;
  background: none;
  padding: 0;
  font-size: 12.5px;
  font-weight: 500;
  color: pp.$ink-soft;
  cursor: pointer;
  transition: color 0.12s ease;

  :deep(.v-icon) {
    transition: transform 0.12s ease;
  }

  &:hover {
    color: pp.$accent-deep;

    :deep(.v-icon) {
      transform: translateX(2px);
    }
  }
}

// Colored swatch preview for shape-effect fx-items (text-effect items preview via the "Аа"
// glyph directly inside .editor-properties__fx-thumb instead, so need no separate element).
.editor-properties__fx-swatch {
  width: 60%;
  height: 60%;
  border-radius: $radius-sm;
}



.editor-properties__section {

  display: flex;

  flex-direction: column;

  gap: $spacing-3;

  padding-bottom: $spacing-4;

  border-bottom: 1px solid pp.$border;

  &:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

}



.editor-properties__section-title {

  margin: 0;

  font-size: 10px;

  font-weight: $font-weight-semibold;

  letter-spacing: 0.12em;

  text-transform: uppercase;

  color: pp.$ink-faint;

}

.editor-properties__spread-note {
  margin: 0 0 $spacing-3;
  font-size: $font-size-body-sm;
  line-height: 1.45;
  color: $text-secondary;
}

.editor-properties__spread-bg {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  margin-bottom: $spacing-3;
  padding: $spacing-3;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;
}

.editor-properties__spread-bg-mode {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $spacing-2;
}

.editor-properties__spread-bg-mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-1;
  min-height: 32px;
  padding: $spacing-1 $spacing-2;
  border: 1px solid $border-light;
  border-radius: $radius-sm;
  background: $bg-primary;
  font-size: $font-size-caption;
  font-weight: $font-weight-medium;
  color: $text-secondary;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;

  &:hover {
    background: $state-hover-bg;
    border-color: $border-default;
    color: $text-primary;
  }

  &--active {
    background: $bg-primary;
    border-color: $border-strong;
    color: $text-primary;
    box-shadow: inset 0 0 0 1px $border-strong;
  }
}

.editor-properties__spread-bg-pages {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  overflow: hidden;
  border: 1px solid $border-light;
  border-radius: $radius-sm;
  background: $bg-primary;
}

.editor-properties__spread-bg-page {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: $spacing-1;
  padding: $spacing-2;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.18s ease;

  & + & {
    border-left: 1px dashed $border-default;
  }

  &:hover {
    background: $state-hover-bg;
  }

  &--active {
    background: rgba($text-primary, 0.04);

    .editor-properties__spread-bg-page-label {
      color: $text-primary;
      font-weight: $font-weight-medium;
    }
  }
}

.editor-properties__spread-bg-page-preview {
  display: block;
  width: 100%;
  aspect-ratio: 595 / 842;
  border: 1px solid $border-light;
  border-radius: $radius-xs;
  overflow: hidden;
}

.editor-properties__spread-bg-page-label {
  font-size: $font-size-caption;
  text-align: center;
  color: $text-muted;
}

.editor-properties__spread-bg-hint {
  margin: 0;
  font-size: $font-size-caption;
  line-height: 1.4;
  color: $text-muted;
  text-align: center;
}



.editor-properties__grid {

  display: grid;

  grid-template-columns: repeat(2, minmax(0, 1fr));

  gap: $spacing-3;

}



.editor-properties__align-row {

  display: flex;

  gap: $spacing-3;

  flex-wrap: wrap;

  // Vuetify's outlined variant borrows its border/icon color from `currentColor` (inherited
  // text color) rather than a fixed value, and its default icon-button size is much smaller
  // than the mockup's 52px circle — both set explicitly here so the buttons stop drifting with
  // whatever color/size Vuetify's own defaults happen to resolve to.
  :deep(.v-btn) {
    width: 52px;
    height: 52px;
    color: pp.$ink;
    border-color: pp.$border;
    background: $white;
  }

  :deep(.v-btn:hover) {
    border-color: pp.$border-strong;
    background: pp.$field-hover;
  }

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

  color: pp.$ink-soft;

  &--spaced {
    margin-top: $spacing-4;
  }

}



.editor-properties__typo-toolbar {

  display: flex;

  flex-wrap: wrap;

  align-items: center;

  gap: $spacing-2;

}



// Each logical cluster (style/case, alignment, spacing) is a single bordered strip with square,
// flush-edge segments separated by hairline dividers — matches the mockup's .fmt-row/.align-row
// treatment rather than a row of individually-rounded pill buttons. Default sizing is a fixed
// 38px per segment (like .fmt-row); the --stretch modifier makes segments share the full width
// evenly (like .align-row), for controls where the group should span the row.
.editor-properties__typo-group {

  display: inline-flex;

  border: 1px solid pp.$border;

  border-radius: pp.$radius;

  overflow: hidden;

  background: $white;

  // Corner-squaring is done via the rounded="0" prop on each v-btn (template) — Vuetify's
  // rounded utility classes carry !important, so a plain border-radius override here cannot
  // win against the global VBtn default (rounded: 'lg', src/plugins/vuetify.ts).
  :deep(.v-btn) {
    flex: 0 0 auto;
    width: 38px;
    height: 34px;
    box-shadow: none;
  }

  :deep(.v-btn:not(:last-child)) {
    border-right: 1px solid pp.$border;
  }

  // Mirrors the mockup's .fmt-btn:hover:not(.active) — inactive segments only tint on hover,
  // active ones keep the solid pink fill from the --v-theme-primary override (see root rule).
  :deep(.v-btn--variant-text:hover) {
    background: pp.$accent-tint;
    color: pp.$accent-deep;
  }

  // Distributes the group's own segments evenly (equal-width buttons) — safe in any parent
  // context since it only affects sizing *inside* the group.
  &--stretch {
    display: flex;

    :deep(.v-btn) {
      flex: 1;
      width: auto;
    }
  }

  // Makes the group itself grow to fill the remaining width of its row — only meaningful when
  // the group sits alongside a sibling in a horizontal container (e.g. .editor-properties__typo-toolbar).
  // Do NOT combine with a group placed directly in a column layout (like .editor-properties__screen):
  // flex:1 there grows along the column's main axis (vertical), not width, and blows up the row's height.
  &--fill {
    flex: 1;
  }
}



.editor-properties__align-text-icon {
  width: 15px;
  height: 15px;
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

  // See the matching note on .editor-properties__style-btn above.
  &.v-btn--variant-flat {
    background: pp.$accent !important;
    color: #fff !important;
  }

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

  min-width: 28px;

  width: 28px;

  height: 28px;

  padding: 0;

  border-radius: $radius-xs;

  // Vuetify re-declares the whole --v-theme-* variable set directly on every themed component
  // via its .v-theme--light class, which wins over an inherited override from an ancestor (like
  // .editor-properties's --v-theme-primary) because a value set on the element itself always
  // beats one inherited from a parent. `color="primary"` (bound in the template) therefore still
  // renders the app's original black, not our pink. Overriding the resolved colors directly on
  // the active (flat-variant) state, matching Vuetify's own !important, sidesteps that entirely.
  &.v-btn--variant-flat {
    background: pp.$accent !important;
    color: #fff !important;
  }

}



.editor-properties__style-icon {

  display: inline-block;

  font-family: Georgia, 'Times New Roman', serif;

  font-size: 14px;

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



.editor-properties__footer {

  display: flex;

  align-items: center;

  gap: $spacing-2;

  flex-shrink: 0;

  padding: $spacing-3 $spacing-4;

  border-top: 1px solid pp.$border-strong;

  background: $white;

}



.editor-properties__duplicate {

  flex: 1;

  min-width: 0;

  height: 44px;

  border-color: pp.$border-strong;

  color: pp.$ink;

  overflow: hidden;

  &:hover {
    background: pp.$field-hover;
  }

}



.editor-properties__delete {

  flex-shrink: 0;

  width: 44px;

  height: 44px;

  border-color: pp.$border;

  color: pp.$ink-soft;

  &:hover {
    color: #8a4b45;
    border-color: #8a4b45;
    background: rgba(138, 75, 69, 0.07);
  }

}



// content-class target for the "Удалить" tooltip (see template) — adds the mockup's downward-
// pointing arrow, safe to assume here since this tooltip is always anchored above the button.


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


