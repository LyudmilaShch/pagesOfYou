<template>
  <div v-if="store.loading && !store.document" class="editor-page-editor__loading">
    <v-progress-circular indeterminate color="primary" />
    <p>Загрузка страницы…</p>
  </div>

  <div v-else-if="loadError" class="editor-page-editor__loading">
    <v-icon size="40" color="error">mdi-alert-circle-outline</v-icon>
    <p>{{ loadError }}</p>
    <v-btn
      variant="outlined"
      :to="{ name: 'admin-magazine-type-edit', params: { id: magazineTypeId }, query: { tab: 'pages' } }"
    >
      К страницам журнала
    </v-btn>
  </div>

  <EditorPage v-else />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import EditorPage from '@/modules/editor/pages/EditorPage.vue'
import { useEditorStore } from '@/modules/editor/store/editor.store'

const route = useRoute()
const store = useEditorStore()
const loadError = ref<string | null>(null)

const magazineTypeId = route.params.magazineTypeId as string
const pageId = route.params.pageId as string

onMounted(async () => {
  try {
    await store.fetchAndLoad(magazineTypeId, pageId)
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Не удалось загрузить страницу'
    loadError.value = message
  }
})

onUnmounted(() => {
  store.reset()
})
</script>

<style scoped lang="scss">
.editor-page-editor__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-4;
  min-height: calc(100vh - 64px);
  color: $text-secondary;
}
</style>
