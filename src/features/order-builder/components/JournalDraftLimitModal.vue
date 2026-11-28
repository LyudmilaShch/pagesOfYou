<template>
  <BaseModal
    :model-value="open"
    labelledby="journal-draft-limit-title"
    fill-mobile
    @update:model-value="emit('close')"
  >
    <div class="journal-limit">
      <h2 id="journal-draft-limit-title" class="journal-limit__title">Достигнут лимит журналов</h2>
      <p class="journal-limit__text">
        {{ journalDraftLimitMessage({ mode, limit, keptInBrowser }) }}
      </p>

      <div v-if="cards.length" class="journal-limit__list">
        <article v-for="card in cards" :key="card.id" class="journal-limit__card">
          <div class="journal-limit__cover">
            <JournalSpreadThumbnail
              v-if="card.canvas"
              :canvas-data="card.canvas"
              :container-ratio="0.75"
            />
            <div v-else class="journal-limit__cover-placeholder" />
          </div>
          <div class="journal-limit__body">
            <h3 class="journal-limit__name">{{ card.name }}</h3>
            <p class="journal-limit__meta">{{ card.meta }}</p>
          </div>
          <div class="journal-limit__card-actions">
            <v-btn
              color="primary"
              size="small"
              class="journal-limit__continue"
              @click="continueDraft(card.id)"
            >
              Продолжить
            </v-btn>
            <v-btn
              icon="mdi-trash-can-outline"
              size="small"
              variant="text"
              aria-label="Удалить черновик"
              :disabled="deletingId === card.id"
              @click="deleteDraft(card.id)"
            />
          </div>
        </article>
      </div>

      <div class="journal-limit__actions">
        <v-btn
          v-if="mode === 'guest'"
          variant="outlined"
          color="secondary"
          class="journal-limit__btn"
          @click="emit('signIn')"
        >
          Войти
        </v-btn>
        <v-btn
          color="primary"
          class="journal-limit__btn"
          :disabled="atLimit"
          :loading="continuing"
          @click="emit('continueNew')"
        >
          Начать новый журнал
        </v-btn>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import BaseModal from '@/components/ui/BaseModal.vue'
import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import { presentCustomerPageCanvas } from '../utils/missing-photos.util'
import { journalDraftLimitMessage } from '../utils/journal-draft-limit.util'
import type { JournalPage, OrderSummary } from '../types/order.types'
import type { StoredLocalDraft } from '../utils/local-draft-storage.util'

const props = withDefaults(
  defineProps<{
    open: boolean
    mode: 'guest' | 'user'
    limit: number
    /** Some guest journals stayed in this browser because the account was already full. */
    keptInBrowser?: boolean
    guestDrafts?: StoredLocalDraft[]
    /** Account drafts (status DRAFT). Shown the same way as guest drafts. */
    userDrafts?: OrderSummary[]
    /** True while a new journal is being created after «Начать новый журнал». */
    continuing?: boolean
    /** Draft id whose delete request is in flight. */
    deletingId?: string | null
  }>(),
  { guestDrafts: () => [], userDrafts: () => [], continuing: false, deletingId: null },
)

const emit = defineEmits<{
  close: []
  signIn: []
  continueNew: []
  continueGuest: [id: string]
  deleteGuest: [id: string]
  continueUser: [id: string]
  deleteUser: [id: string]
}>()

const atLimit = computed(
  () => (props.mode === 'guest' ? props.guestDrafts.length : props.userDrafts.length) >= props.limit,
)

const cards = computed(() => {
  if (props.mode === 'guest') {
    return props.guestDrafts.map((draft) => ({
      id: draft.id,
      name: draft.order.magazineType.name,
      meta: `Сохранено ${formatDate(draft.savedAt)}`,
      canvas: coverOf(draft.order.journalPages[0]),
    }))
  }
  return props.userDrafts.map((draft) => ({
    id: draft.id,
    name: draft.magazineType.name,
    meta: `Изменено ${formatDate(draft.updatedAt)}`,
    canvas: coverOf(draft.journalPages[0]),
  }))
})

function continueDraft(id: string): void {
  if (props.mode === 'guest') {
    emit('continueGuest', id)
    return
  }
  emit('continueUser', id)
}

function deleteDraft(id: string): void {
  if (props.mode === 'guest') {
    emit('deleteGuest', id)
    return
  }
  emit('deleteUser', id)
}

function coverOf(
  page: Pick<JournalPage, 'slotType' | 'pageSnapshot' | 'placeholderValues'> | undefined,
): CanvasData | null {
  if (!page) {
    return null
  }
  return presentCustomerPageCanvas(page)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped lang="scss">
.journal-limit {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}

.journal-limit__title {
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-regular;
  color: $text-primary;
  margin: 0 0 $spacing-3;
  text-align: center;
}

.journal-limit__text {
  font-size: $font-size-body-sm;
  color: $text-secondary;
  text-align: center;
  margin: 0 0 $spacing-6;
}

.journal-limit__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
  margin-bottom: $spacing-6;
  max-height: 320px;
  overflow-y: auto;
}

.journal-limit__card {
  display: flex;
  align-items: center;
  gap: $spacing-4;
  padding: $spacing-3;
  background: $bg-elevated;
  border: 1px solid $border-light;
  border-radius: $radius-md;
}

.journal-limit__cover {
  position: relative;
  width: 64px;
  aspect-ratio: 3 / 4;
  flex-shrink: 0;
  border-radius: $radius-sm;
  overflow: hidden;
  background: $bg-tertiary;
}

.journal-limit__cover-placeholder {
  position: absolute;
  inset: 0;
  background: $bg-tertiary;
}

.journal-limit__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.journal-limit__name {
  font-family: $font-family-display;
  font-size: $font-size-body;
  font-weight: $font-weight-medium;
  color: $text-primary;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.journal-limit__meta {
  font-size: $font-size-caption;
  color: $text-muted;
  margin: 0;
}

.journal-limit__card-actions {
  display: flex;
  align-items: center;
  gap: $spacing-1;
  flex-shrink: 0;
}

.journal-limit__continue {
  text-transform: none;
}

@include mobile-only {
  .journal-limit__text {
    margin-bottom: $spacing-4;
    flex-shrink: 0;
  }

  .journal-limit {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }

  .journal-limit__title {
    padding-inline: 2rem;
    line-height: 1.15;
    flex-shrink: 0;
  }

  .journal-limit__list {
    flex: 1 1 auto;
    min-height: 0;
    max-height: none;
    margin-bottom: $spacing-4;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .journal-limit__card {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    grid-template-areas:
      'cover body'
      'actions actions';
    align-items: center;
    column-gap: $spacing-3;
    row-gap: $spacing-3;
  }

  .journal-limit__cover {
    grid-area: cover;
    width: 56px;
  }

  .journal-limit__body {
    grid-area: body;
  }

  .journal-limit__name {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .journal-limit__card-actions {
    grid-area: actions;
  }

  .journal-limit__continue {
    flex: 1;
  }
}

.journal-limit__actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;

  @include mobile-only {
    flex-shrink: 0;
  }
}

.journal-limit__btn {
  width: 100%;
  text-transform: none;
}
</style>
