<template>
  <div class="fonts-page">
    <div class="fonts-page__inner">
      <div class="fonts-page__header">
        <div>
          <p class="fonts-page__eyebrow text-caption text-secondary">Библиотека</p>
          <h1 class="fonts-page__title">Шрифты</h1>
          <p class="fonts-page__subtitle">
            Пользовательские шрифты, доступные для выбора в редакторе шаблонов и при заполнении заказа.
          </p>
        </div>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
          Добавить шрифт
        </v-btn>
      </div>

      <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

      <div v-if="!loading && fonts.length === 0" class="fonts-page__empty">
        <v-icon size="40" color="textDisabled">mdi-format-font</v-icon>
        <p>Шрифтов пока нет</p>
        <span>Добавьте первый пользовательский шрифт</span>
      </div>

      <div v-else class="fonts-page__list">
        <div
          v-for="font in fonts"
          :key="font.id"
          class="fonts-page__item"
          :class="{ 'fonts-page__item--dragging': draggingId === font.id }"
          draggable="true"
          @dragstart="onDragStart(font.id)"
          @dragover.prevent
          @drop="onDrop(font.id)"
          @dragend="draggingId = null"
        >
          <div class="fonts-page__drag" aria-hidden="true">
            <v-icon size="18">mdi-drag-vertical</v-icon>
          </div>

          <div class="fonts-page__meta">
            <span class="fonts-page__name" :style="{ fontFamily: font.fontFamily }">
              {{ font.name }}
            </span>
            <span class="fonts-page__variants">{{ describeVariants(font) }}</span>
          </div>

          <v-switch
            :model-value="font.isActive"
            color="primary"
            density="compact"
            hide-details
            @update:model-value="toggleActive(font, Boolean($event))"
          />

          <div class="fonts-page__actions">
            <v-btn
              icon="mdi-pencil-outline"
              size="small"
              variant="text"
              aria-label="Изменить"
              @click="openEdit(font)"
            />
            <v-btn
              icon="mdi-delete-outline"
              size="small"
              variant="text"
              color="error"
              aria-label="Удалить"
              @click="openDelete(font)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ══ Create / Edit dialog ═══════════════════════════════════════════ -->
    <v-dialog v-model="formDialog.open" max-width="520" scrollable>
      <v-card>
        <v-card-title>{{ formDialog.editId ? 'Редактировать шрифт' : 'Новый шрифт' }}</v-card-title>
        <v-divider />
        <v-card-text>
          <div class="fonts-form">
            <v-text-field v-model="form.name" label="Название *" variant="outlined" hide-details="auto" />

            <div class="fonts-form__slot">
              <p class="fonts-form__slot-label">Regular (обязательно)</p>
              <FontFileUploader v-model="form.regularFileUrl" :removable="false" />
            </div>

            <div class="fonts-form__slot">
              <p class="fonts-form__slot-label">Bold</p>
              <FontFileUploader v-model="form.boldFileUrl" label="Файл жирного начертания" />
            </div>

            <div class="fonts-form__slot">
              <p class="fonts-form__slot-label">Italic</p>
              <FontFileUploader v-model="form.italicFileUrl" label="Файл курсивного начертания" />
            </div>

            <div class="fonts-form__slot">
              <p class="fonts-form__slot-label">Bold Italic</p>
              <FontFileUploader v-model="form.boldItalicFileUrl" label="Файл жирного курсива" />
            </div>

            <v-switch v-model="form.isActive" label="Активен" color="primary" hide-details />
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="formDialog.open = false">Отмена</v-btn>
          <v-btn color="primary" :loading="formDialog.submitting" :disabled="!canSubmit" @click="submitForm">
            {{ formDialog.editId ? 'Сохранить' : 'Создать' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══ Delete confirmation ════════════════════════════════════════════ -->
    <v-dialog v-model="deleteDialog.open" max-width="420">
      <v-card>
        <v-card-title>Удалить шрифт?</v-card-title>
        <v-card-text>
          Шрифт «{{ deleteDialog.name }}» будет скрыт и больше не появится в редакторе. Уже
          сохранённые страницы, использующие его, продолжат ссылаться на него по имени — если файлы
          останутся доступны, текст на них не сломается.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog.open = false">Отмена</v-btn>
          <v-btn color="error" :loading="deleteDialog.loading" @click="confirmDelete">Удалить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom right" :timeout="3500">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import FontFileUploader from '@/components/FontFileUploader.vue'
import { adminFontsApi, type AdminFont } from '@/shared/api/admin/fonts.api'
import { extractApiErrorMessage } from '@/shared/utils/api-error.util'
import { ensureCustomFontsLoaded, invalidateCustomFontsCache } from '@/modules/editor/utils/custom-fonts.util'

const fonts = ref<AdminFont[]>([])
const loading = ref(false)
const draggingId = ref<string | null>(null)

const snackbar = reactive({ show: false, text: '', color: 'success' as string })

function notify(text: string, color = 'success'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

function describeVariants(font: AdminFont): string {
  const variants = ['Regular']
  if (font.boldFileUrl) variants.push('Bold')
  if (font.italicFileUrl) variants.push('Italic')
  if (font.boldItalicFileUrl) variants.push('Bold Italic')
  return variants.join(' · ')
}

async function loadFonts(): Promise<void> {
  loading.value = true
  try {
    fonts.value = await adminFontsApi.list()
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось загрузить шрифты'), 'error')
  } finally {
    loading.value = false
  }
}

// ── Form dialog ──────────────────────────────────────────────────────────────

const emptyForm = () => ({
  name: '',
  regularFileUrl: null as string | null,
  boldFileUrl: null as string | null,
  italicFileUrl: null as string | null,
  boldItalicFileUrl: null as string | null,
  isActive: true,
})

const form = reactive(emptyForm())
const formDialog = reactive({ open: false, editId: null as string | null, submitting: false })

// A computed (not a ref updated by hand at a few call sites) so it stays correct as the admin
// types the name or a FontFileUploader slot resolves — those don't go through openCreate/openEdit.
const canSubmit = computed(() => Boolean(form.name.trim() && form.regularFileUrl))

function openCreate(): void {
  formDialog.editId = null
  Object.assign(form, emptyForm())
  formDialog.open = true
}

function openEdit(font: AdminFont): void {
  formDialog.editId = font.id
  Object.assign(form, {
    name: font.name,
    regularFileUrl: font.regularFileUrl,
    boldFileUrl: font.boldFileUrl,
    italicFileUrl: font.italicFileUrl,
    boldItalicFileUrl: font.boldItalicFileUrl,
    isActive: font.isActive,
  })
  formDialog.open = true
}

async function submitForm(): Promise<void> {
  if (!canSubmit.value || !form.regularFileUrl) {
    return
  }

  formDialog.submitting = true
  try {
    const payload = {
      name: form.name.trim(),
      regularFileUrl: form.regularFileUrl,
      boldFileUrl: form.boldFileUrl ?? undefined,
      italicFileUrl: form.italicFileUrl ?? undefined,
      boldItalicFileUrl: form.boldItalicFileUrl ?? undefined,
      isActive: form.isActive,
    }

    if (formDialog.editId) {
      await adminFontsApi.update(formDialog.editId, payload)
      notify('Шрифт обновлён')
    } else {
      await adminFontsApi.create(payload)
      notify('Шрифт создан')
    }

    formDialog.open = false
    await loadFonts()
    // Refresh the in-app font registry so the just-saved font's preview (and the editor dropdown,
    // if open in this same session) picks up the change immediately.
    await invalidateCustomFontsCache()
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось сохранить шрифт'), 'error')
  } finally {
    formDialog.submitting = false
  }
}

async function toggleActive(font: AdminFont, isActive: boolean): Promise<void> {
  try {
    await adminFontsApi.update(font.id, { isActive })
    font.isActive = isActive
    await invalidateCustomFontsCache()
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось изменить статус шрифта'), 'error')
  }
}

// ── Delete dialog ────────────────────────────────────────────────────────────

const deleteDialog = reactive({ open: false, id: null as string | null, name: '', loading: false })

function openDelete(font: AdminFont): void {
  deleteDialog.id = font.id
  deleteDialog.name = font.name
  deleteDialog.open = true
}

async function confirmDelete(): Promise<void> {
  if (!deleteDialog.id) {
    return
  }

  deleteDialog.loading = true
  try {
    await adminFontsApi.remove(deleteDialog.id)
    deleteDialog.open = false
    notify('Шрифт удалён')
    await loadFonts()
    await invalidateCustomFontsCache()
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось удалить шрифт'), 'error')
  } finally {
    deleteDialog.loading = false
  }
}

// ── Reorder ──────────────────────────────────────────────────────────────────

function onDragStart(id: string): void {
  draggingId.value = id
}

async function onDrop(targetId: string): Promise<void> {
  const sourceId = draggingId.value
  if (!sourceId || sourceId === targetId) {
    return
  }

  const reordered = [...fonts.value]
  const fromIndex = reordered.findIndex((font) => font.id === sourceId)
  const toIndex = reordered.findIndex((font) => font.id === targetId)

  if (fromIndex === -1 || toIndex === -1) {
    return
  }

  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)
  fonts.value = reordered.map((font, index) => ({ ...font, sortOrder: index }))

  try {
    await adminFontsApi.reorder({
      items: fonts.value.map((font, index) => ({ id: font.id, sortOrder: index })),
    })
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось изменить порядок'), 'error')
    await loadFonts()
  }
}

onMounted(() => {
  void loadFonts()
  // Registers active fonts as real @font-face rules so each row's name preview
  // (`:style="{ fontFamily: font.fontFamily }"`) renders in its actual typeface.
  void ensureCustomFontsLoaded()
})
</script>

<style scoped lang="scss">
.fonts-page {
  min-height: 100%;
}

.fonts-page__inner {
  @include page-container;
  max-width: 900px;
  margin-inline: auto;
  padding-block: $spacing-8 $spacing-16;
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.fonts-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $spacing-4;
}

.fonts-page__title {
  margin: 0 0 $spacing-1;
  font-family: $font-family-display;
  font-size: $font-size-h3;
  font-weight: $font-weight-regular;
  color: $text-primary;
}

.fonts-page__subtitle {
  margin: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
  max-width: 520px;
}

.fonts-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-12;
  border: 1px dashed $border-light;
  border-radius: $radius-md;
  color: $text-muted;
  text-align: center;
}

.fonts-page__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.fonts-page__item {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: $spacing-4;
  padding: $spacing-3 $spacing-4;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;
  cursor: grab;

  &--dragging {
    opacity: 0.55;
  }
}

.fonts-page__drag {
  color: $text-muted;
}

.fonts-page__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.fonts-page__name {
  font-size: $font-size-body-lg;
  font-weight: $font-weight-medium;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fonts-page__variants {
  font-size: $font-size-caption;
  color: $text-muted;
}

.fonts-page__actions {
  display: flex;
  gap: $spacing-1;
}

// ── Form ──────────────────────────────────────────────────────────────────────
.fonts-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding-top: $spacing-2;
}

.fonts-form__slot {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.fonts-form__slot-label {
  margin: 0;
  font-size: $font-size-caption;
  font-weight: $font-weight-medium;
  color: $text-secondary;
}
</style>
