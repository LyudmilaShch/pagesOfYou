<template>
  <div v-if="visible" class="draft-tab-warning" role="status">
    Этот журнал открыт в другой вкладке. Если править в обеих, сохранится последняя правка.
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useOrderBuilderStore } from '../stores/order-builder.store'
import {
  createTabId,
  isForeignDraftLock,
  readDraftLock,
  subscribeDraftLocks,
  writeDraftLock,
  type DraftLock,
} from '../utils/draft-tab-lock.util'

const HEARTBEAT_MS = 4_000

const store = useOrderBuilderStore()
const tabId = createTabId()
const foreignLock = ref<DraftLock | null>(null)

const draftId = computed(() => (store.isLocalDraft ? store.order?.id ?? null : null))
const visible = computed(() => isForeignDraftLock(foreignLock.value, tabId, draftId.value))

function publish(): void {
  const id = draftId.value
  if (!id) {
    return
  }
  writeDraftLock({ draftId: id, tabId, at: Date.now() })
}

function release(): void {
  const current = readDraftLock()
  if (current?.tabId === tabId) {
    writeDraftLock({ ...current, at: 0 })
  }
}

function onLock(lock: DraftLock | null): void {
  foreignLock.value = lock
}

let stop: (() => void) | null = null
let heartbeat: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  stop = subscribeDraftLocks(onLock)
  foreignLock.value = readDraftLock()
  publish()
  heartbeat = setInterval(publish, HEARTBEAT_MS)
  window.addEventListener('beforeunload', release)
})

onBeforeUnmount(() => {
  stop?.()
  if (heartbeat) {
    clearInterval(heartbeat)
  }
  window.removeEventListener('beforeunload', release)
  release()
})

watch(draftId, () => {
  foreignLock.value = readDraftLock()
  publish()
})
</script>

<style scoped lang="scss">
.draft-tab-warning {
  position: sticky;
  top: 0;
  z-index: 30;
  padding: 10px 16px;
  background: #fff4e5;
  color: #7a4b00;
  text-align: center;
  font-size: 14px;
  line-height: 1.4;
}
</style>
