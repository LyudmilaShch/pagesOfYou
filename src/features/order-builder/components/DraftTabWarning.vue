<template>
  <div v-if="visible" class="draft-tab-warning" role="status">
    Этот журнал открыт в другой вкладке. Если править в обеих, сохранится последняя правка.
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useOrderBuilderStore } from '../stores/order-builder.store'
import {
  PRESENCE_HEARTBEAT_MS,
  createTabId,
  hasOtherTabOnDraft,
  mergePresences,
  readDraftPresences,
  subscribeDraftPresences,
  writeDraftPresence,
  type TabPresence,
} from '../utils/draft-tab-lock.util'

const store = useOrderBuilderStore()
const tabId = createTabId()
const presences = ref<TabPresence[]>([])
const now = ref(Date.now())

const draftId = computed(() => (store.isLocalDraft ? store.order?.id ?? null : null))
const visible = computed(() => hasOtherTabOnDraft(presences.value, tabId, draftId.value, now.value))

function apply(incoming: TabPresence[]): void {
  const at = Date.now()
  now.value = at
  presences.value = mergePresences(presences.value, incoming, at)
}

function beat(left = false): void {
  const at = Date.now()
  now.value = at
  const presence: TabPresence = {
    tabId,
    draftId: left ? null : draftId.value,
    at,
    left,
  }
  const next = mergePresences(mergePresences(presences.value, readDraftPresences(), at), [presence], at)
  presences.value = next
  writeDraftPresence(next, presence)
}

function publish(): void {
  if (!draftId.value) {
    return
  }
  beat(false)
}

function release(): void {
  beat(true)
}

let stop: (() => void) | null = null
let heartbeat: ReturnType<typeof setInterval> | null = null
let clock: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  stop = subscribeDraftPresences(apply)
  apply(readDraftPresences())
  publish()
  heartbeat = setInterval(publish, PRESENCE_HEARTBEAT_MS)
  // Re-check TTL even when no message arrives, so a crashed tab's banner eventually hides.
  clock = setInterval(() => {
    now.value = Date.now()
    presences.value = mergePresences(presences.value, [], now.value)
  }, 1_000)
  window.addEventListener('beforeunload', release)
})

onBeforeUnmount(() => {
  stop?.()
  if (heartbeat) {
    clearInterval(heartbeat)
  }
  if (clock) {
    clearInterval(clock)
  }
  window.removeEventListener('beforeunload', release)
  release()
})

watch(draftId, (id, previous) => {
  if (id) {
    publish()
    return
  }
  if (previous) {
    release()
  }
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
