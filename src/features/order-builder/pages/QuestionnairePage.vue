<template>
  <div v-if="isLoading" class="questionnaire-page__loading">
    <v-progress-circular indeterminate color="primary" />
    <p>Загрузка анкеты…</p>
  </div>

  <div v-else-if="loadErrorMessage" class="questionnaire-page__loading">
    <v-icon size="40" color="error">mdi-alert-circle-outline</v-icon>
    <p>{{ loadErrorMessage }}</p>
    <v-btn variant="outlined" :to="{ name: 'create-order' }">Начать заново</v-btn>
  </div>

  <div v-else class="questionnaire-page">

    <!-- ── Top navigation bar — same chrome as Шаг 1 (CreateOrderPage.vue) ──────────────── -->
    <header class="questionnaire-page__topbar">
      <div class="questionnaire-page__topbar-inner">
        <router-link to="/" class="questionnaire-page__brand">Вау, ми!</router-link>

        <div class="questionnaire-page__steps-label" aria-label="Шаг 3 из 5">
          <span class="questionnaire-page__steps-current">3</span>
          <span class="questionnaire-page__steps-sep">/</span>
          <span class="questionnaire-page__steps-total">5</span>
        </div>
      </div>
    </header>

    <div class="questionnaire-page__step-progress">
      <v-progress-linear :model-value="ORDER_STEP_PROGRESS" color="primary" bg-opacity="0.15" height="3" />
    </div>

    <!-- ── Body: 3D spread book (left) + question (right) ──────────────────────────────────── -->
    <div class="questionnaire-page__body">
      <div class="questionnaire-page__body-inner">
        <div class="questionnaire-page__book-column" aria-label="Развороты журнала">
          <QuestionnaireBook
            :pages="store.order?.journalPages ?? []"
            :canvas-data-by-page-id="canvasDataByPageId"
            :focus-page-id="focusPageId"
            :pulsing-page-ids="pulsingPageIds"
            :fill-by-page-id="fillByPageId"
            :pending-element-ids="pendingAiElementIds"
            :drop-enabled="false"
            ai-text-edit-enabled
            @edit-ai-text="openAiTextEditor"
            @regenerate-ai-text="handleRegenerateAiText"
          />
        </div>

        <main class="questionnaire-page__main">
          <div class="questionnaire-page__main-scroll">
          <div class="questionnaire-page__container">
            <div v-if="currentStep" :key="currentStep.journalPageId" class="questionnaire-page__question">
              <header class="questionnaire-page__intro">
                <p class="questionnaire-page__eyebrow text-caption text-secondary">Шаг 3 — Анкета</p>
                <h1 class="questionnaire-page__title text-h3">{{ currentStepLabel }}</h1>
              </header>

              <!-- Every question homed on this journal page, answered together on one screen —
                   see QuestionnaireStep in questionnaire.util.ts. -->
              <div
                v-for="(question, index) in currentStep.questions"
                :key="question.key"
                class="questionnaire-page__field-group"
              >
                <label class="questionnaire-page__field-label text-body">
                  {{ question.label }}
                  <span v-if="question.isRequired" class="questionnaire-page__required">*</span>
                </label>
                <p v-if="question.helpText" class="questionnaire-page__field-help text-body-sm text-secondary">
                  {{ question.helpText }}
                </p>

                <div class="questionnaire-page__field">
                  <v-text-field
                    v-if="question.type === 'TEXT'"
                    :model-value="getTextValue(question.key)"
                    :placeholder="question.placeholder ?? undefined"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    :autofocus="index === 0"
                    @update:model-value="setTextValue(question.key, $event)"
                  />

                  <v-textarea
                    v-else-if="question.type === 'TEXTAREA'"
                    :model-value="getTextValue(question.key)"
                    :placeholder="question.placeholder ?? undefined"
                    variant="outlined"
                    density="comfortable"
                    rows="4"
                    hide-details="auto"
                    :autofocus="index === 0"
                    @update:model-value="setTextValue(question.key, $event)"
                  />

                  <v-text-field
                    v-else-if="question.type === 'DATE'"
                    type="date"
                    :model-value="getTextValue(question.key)"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    @update:model-value="setTextValue(question.key, $event)"
                  />

                  <v-select
                    v-else-if="question.type === 'SELECT'"
                    :model-value="getTextValue(question.key) || null"
                    :items="question.options"
                    item-title="label"
                    item-value="value"
                    :placeholder="question.placeholder ?? undefined"
                    variant="outlined"
                    density="comfortable"
                    clearable
                    hide-details="auto"
                    @update:model-value="setTextValue(question.key, $event ?? '')"
                  />

                  <QuestionImageField
                    v-else-if="question.type === 'IMAGE'"
                    :model-value="getImageUrl(question.key)"
                    :scope="galleryScope"
                    @update:model-value="setImageUrl(question.key, $event)"
                  />

                  <QuestionGalleryField
                    v-else-if="question.type === 'GALLERY'"
                    :model-value="getGalleryUrls(question.key)"
                    :scope="galleryScope"
                    @update:model-value="setGalleryUrls(question.key, $event)"
                  />
                </div>
              </div>

              <!-- Own controls for stepping between pages of the questionnaire — separate from the
                   bottom bar's Назад/Продолжить, which move between the order-creation steps. -->
              <div class="questionnaire-page__step-actions">
                <v-btn v-if="currentIndex > 0" variant="text" @click="goBack">Назад</v-btn>
                <v-spacer />
                <template v-if="!isLastStep">
                  <v-btn v-if="!currentStepHasRequired" variant="text" @click="goSkip">Пропустить</v-btn>
                  <v-btn color="primary" @click="goNext">Далее</v-btn>
                </template>
              </div>
            </div>

            <div v-else class="questionnaire-page__empty">
              <p>Для выбранных страниц журнала пока нет вопросов анкеты.</p>
            </div>
          </div>
          </div>
        </main>
      </div>
    </div>

    <!-- ── Bottom action bar — same chrome as Шаг 1: moves between order-creation steps ─────── -->
    <footer class="questionnaire-page__actions">
      <div class="questionnaire-page__footer-float">
        <p class="questionnaire-page__stats">
          Отвечено вопросов · {{ answeredQuestionsCount }} из {{ totalQuestions }}
        </p>

        <button
          v-if="missingPhotoCount > 0"
          type="button"
          class="questionnaire-page__missing-photos-pill"
          @click="missingPhotosModalOpen = true"
        >
          <v-icon size="16">mdi-alert-outline</v-icon>
          Не хватает {{ missingPhotoCount }} фото
        </button>
      </div>

      <div class="questionnaire-page__actions-inner">
        <v-btn
          variant="outlined"
          :size="isMobileViewport ? 'default' : 'large'"
          color="primary"
          class="questionnaire-page__btn-back"
          @click="goToPreviousStep"
        >
          Назад
        </v-btn>

        <v-btn
          color="primary"
          :size="isMobileViewport ? 'default' : 'large'"
          class="questionnaire-page__btn-next"
          :disabled="!allRequiredAnswered"
          :loading="isFinishing"
          @click="finish"
        >
          Продолжить
          <v-icon end>mdi-arrow-right</v-icon>
        </v-btn>
      </div>
    </footer>

    <v-snackbar :model-value="submitErrorMessage !== null" color="error" @update:model-value="submitErrorMessage = null">
      {{ submitErrorMessage }}
    </v-snackbar>

    <AiTextEditModal
      :open="aiTextEditModal.open"
      :initial-text="aiTextEditModal.initialText"
      :length-constraint="aiTextEditModal.lengthConstraint"
      :loading="aiTextEditModal.saving"
      @close="closeAiTextEditor"
      @save="saveAiTextEdit"
    />

    <MissingPhotosModal
      :open="missingPhotosModalOpen"
      @close="missingPhotosModalOpen = false"
      @continue="continueAfterPhotosFilled"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { isAiTextElement } from '@/modules/editor/models'
import type { AiTextPlaceholder, LengthConstraint } from '@/modules/editor/models'
import { flattenTree } from '@/modules/editor/utils/element-tree.util'
import { catalogApi } from '../api/catalog.api'
import { useOrderBuilderStore } from '../stores/order-builder.store'
import { getGalleryScope } from '../utils/photo-gallery-scope.util'
import { getJournalPageDisplayName } from '../utils/journal-structure.util'
import {
  buildQuestionnaireFlow,
  isQuestionAnswered,
  type QuestionnaireFlow,
  type QuestionnaireStep,
} from '../utils/questionnaire.util'
import {
  materializeCanvasData,
  type LocalPlaceholderDraft,
} from '../utils/merge-placeholder-element.util'
import type { Question } from '../types/question.types'
import type { QuestionAnswer, QuestionAnswerJsonValue } from '../types/order.types'
import QuestionImageField from '../components/questionnaire/QuestionImageField.vue'
import QuestionGalleryField from '../components/questionnaire/QuestionGalleryField.vue'
import QuestionnaireBook from '../components/questionnaire/QuestionnaireBook.vue'
import AiTextEditModal from '../components/AiTextEditModal.vue'
import MissingPhotosModal from '../components/MissingPhotosModal.vue'
import { collectPhotoSlotPreview, countEmptyPhotoSlots } from '../utils/missing-photos.util'

const route = useRoute()
const router = useRouter()
const store = useOrderBuilderStore()

const orderId = computed(() => route.params.orderId as string)
const galleryScope = computed(() => getGalleryScope(store))

// This is Шаг 3 of 5 — same hardcoded step number as .questionnaire-page__steps-label below.
const ORDER_STEP_PROGRESS = (3 / 5) * 100

// Same threshold as the `mobile-only` SCSS mixin (`$breakpoint-mobile-max: 767px`).
const isMobileViewport = ref(false)
let mobileMediaQuery: MediaQueryList | null = null

function updateIsMobileViewport(): void {
  isMobileViewport.value = mobileMediaQuery?.matches ?? false
}

const isLoading = ref(true)
const loadErrorMessage = ref<string | null>(null)
const flow = ref<QuestionnaireFlow>({
  steps: [],
  pageQuestionKeys: new Map(),
  affectedPageIds: new Map(),
  aiTextElementsByQuestionKey: new Map(),
})
const currentIndex = ref(0)

interface LocalAnswer {
  textValue: string | null
  jsonValue: QuestionAnswerJsonValue | null
}

const answers = reactive<Record<string, LocalAnswer>>({})

/** Mirrors JournalPageEditorPage.vue's ensureOrderLoaded 1-1: a local draft only exists once the
 * user has already gone through CreateOrderPage in this session — a cold URL hit for a guest has
 * nothing to load. */
async function ensureOrderLoaded(): Promise<void> {
  if (store.order?.id === orderId.value) {
    return
  }

  if (orderId.value.startsWith('local-')) {
    throw new Error(
      'Черновик заказа был потерян (например, из-за обновления страницы) — начните заново.',
    )
  }

  await store.loadOrder(orderId.value)
}

function seedAnswersFromOrder(): void {
  for (const key of Object.keys(answers)) {
    delete answers[key]
  }
  for (const answer of store.order?.questionAnswers ?? []) {
    answers[answer.questionKey] = { textValue: answer.textValue, jsonValue: answer.jsonValue }
  }
}

async function load(): Promise<void> {
  isLoading.value = true
  loadErrorMessage.value = null

  try {
    await ensureOrderLoaded()
    const order = store.order
    if (!order) {
      throw new Error('Заказ не найден.')
    }

    seedAnswersFromOrder()

    const questions: Question[] = await catalogApi.getQuestions(order.magazineTypeId)
    flow.value = buildQuestionnaireFlow(order.journalPages, questions)
    currentIndex.value = 0
  } catch (err: unknown) {
    loadErrorMessage.value = err instanceof Error ? err.message : 'Не удалось загрузить анкету.'
  } finally {
    isLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// Field getters/setters — optimistic local state, debounce-flushed to the store.
// ---------------------------------------------------------------------------

function getTextValue(key: string): string {
  return answers[key]?.textValue ?? ''
}

function getImageUrl(key: string): string | null {
  return answers[key]?.jsonValue?.url ?? null
}

function getGalleryUrls(key: string): string[] {
  return answers[key]?.jsonValue?.urls ?? []
}

const AUTOSAVE_DEBOUNCE_MS = 2500
const dirtyKeys = new Set<string>()
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFlush(): void {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
  }
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null
    void flushAnswers()
  }, AUTOSAVE_DEBOUNCE_MS)
}

// Question keys with an edit that hasn't yet round-tripped through a completed save — i.e. still
// dirty (debounce hasn't fired) OR mid-flush (request in flight). Marked the INSTANT the user
// types (in `markDirty`, below), not just once a flush actually starts, so an ai-text-placeholder
// fed by the key starts shimmering (see `pendingAiElementIds`) right away — there's no live preview
// for AI text the way there is for a plain field, so this is the only feedback the user gets before
// the (possibly several-second) generation actually lands.
const pendingQuestionKeys = reactive(new Set<string>())

function markDirty(key: string): void {
  dirtyKeys.add(key)
  pendingQuestionKeys.add(key)
  scheduleFlush()
}

// Mirrors `answers`, but only for keys not yet confirmed by a completed save — the live-preview
// overlay (see `canvasDataByPageId` below) reads this instead of `answers` directly so a card's
// preview never regresses to stale template content between "the user moved off this question"
// and "the debounced/forced save for it actually resolved" (the base layer, sourced from
// `store.order`, only catches up once that save lands).
const pendingOverlayByKey = reactive<Record<string, LocalAnswer>>({})

// ai-text-placeholder element ids currently shimmering — derived from `pendingQuestionKeys` rather
// than tracked directly, so it updates live as the user types (not just once a flush starts).
const pendingAiElementIds = computed<Set<string>>(() => {
  const ids = new Set<string>()
  for (const key of pendingQuestionKeys) {
    for (const entry of flow.value.aiTextElementsByQuestionKey.get(key) ?? []) {
      ids.add(entry.elementId)
    }
  }
  return ids
})

function setTextValue(key: string, value: string): void {
  answers[key] = { textValue: value, jsonValue: answers[key]?.jsonValue ?? null }
  pendingOverlayByKey[key] = answers[key]
  markDirty(key)
}

function setImageUrl(key: string, url: string | null): void {
  answers[key] = { textValue: null, jsonValue: url ? { url } : null }
  pendingOverlayByKey[key] = answers[key]
  markDirty(key)
}

function setGalleryUrls(key: string, urls: string[]): void {
  answers[key] = { textValue: null, jsonValue: urls.length > 0 ? { urls } : null }
  pendingOverlayByKey[key] = answers[key]
  markDirty(key)
}

/** Awaited by callers that need the save (and any AI generation it triggers server-side) to be
 * actually finished before acting on the result — e.g. navigating to the editor to look at the
 * filled-in template. `handleBeforeUnload` is the one caller that can't await (the browser is
 * already closing), so it fires this without awaiting — best-effort there, same as before. */
async function flushAnswers(): Promise<void> {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
  if (dirtyKeys.size === 0) {
    return
  }

  const flushedKeys = [...dirtyKeys]
  const payload = flushedKeys.map((key) => ({
    questionKey: key,
    textValue: answers[key]?.textValue ?? undefined,
    jsonValue: answers[key]?.jsonValue ?? undefined,
  }))
  dirtyKeys.clear()

  await store.saveQuestionnaireAnswers(payload)

  // The base layer (sourced from the just-refreshed store.order) now reflects these keys, so the
  // overlay/shimmer is no longer needed for them — UNLESS a fresher edit re-dirtied the same key
  // while this save was in flight, in which case leave both for THAT flush's own completion to clear.
  for (const key of flushedKeys) {
    if (!dirtyKeys.has(key)) {
      delete pendingOverlayByKey[key]
      pendingQuestionKeys.delete(key)
    }
  }
}

function handleBeforeUnload(): void {
  void flushAnswers()
}

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------

// Flat list of every question across every step — what the progress bar/"Продолжить" gate count
// against, kept at question granularity even though navigation itself now moves a whole step
// (journal page) at a time (see QuestionnaireStep in questionnaire.util.ts).
const allQuestions = computed<Question[]>(() => flow.value.steps.flatMap((step) => step.questions))
const totalQuestions = computed(() => allQuestions.value.length)
const totalSteps = computed(() => flow.value.steps.length)
// Fills as questions actually get answered (skipping ahead without answering doesn't move it) —
// not just "how far into the list is the current position", which would fill even on skips and
// jump backwards when the user steps back to an earlier step.
const answeredQuestionsCount = computed(
  () => allQuestions.value.filter((question) => isQuestionAnswered(question, answersAsMap.value)).length,
)
const currentStep = computed<QuestionnaireStep | null>(() => flow.value.steps[currentIndex.value] ?? null)
// >= rather than === so a questionnaire with zero steps trivially has no "next step" either — the
// per-step Далее/Пропустить controls just don't render.
const isLastStep = computed(() => currentIndex.value >= totalSteps.value - 1)
// Hides "Пропустить" — skipping a step with a required question would leave it unanswered with no
// way back to it short of using "Назад" repeatedly, and the bottom bar's "Продолжить" is already
// gated on every required question being filled in, so skipping past one here would just dead-end.
const currentStepHasRequired = computed(() => Boolean(currentStep.value?.questions.some((q) => q.isRequired)))
// The step's own home page, plus every OTHER page any of its questions also happens to affect
// (e.g. a question shared with another page via a duplicated template) — used to pulse every page
// that visibly changed, not just the primary one.
const currentAffectedPageIds = computed<Set<string>>(() => {
  const step = currentStep.value
  if (!step) {
    return new Set()
  }
  const set = new Set<string>([step.journalPageId])
  for (const question of step.questions) {
    for (const pageId of flow.value.affectedPageIds.get(question.key) ?? []) {
      set.add(pageId)
    }
  }
  return set
})

// The step's own home page — the page the 3D book jumps to (no flip animation) whenever the step
// changes. `focusOverridePageId` (see `goNext`) briefly holds this on the page just answered
// instead, when that step feeds an AI-text block — otherwise the book jumps to the NEXT step's
// page in the same instant, and the user never actually sees the pulse/shimmer that confirms their
// answer did something, since AI text has no live-while-typing preview to have already shown them
// that.
const focusOverridePageId = ref<string | null>(null)
const focusPageId = computed<string | null>(() => focusOverridePageId.value ?? currentStep.value?.journalPageId ?? null)

// Mirrors JournalStructurePanel.vue's/QuestionnaireBook.vue's own numbering: only SPREAD slots get
// a running count, COVER/BACK_COVER get their fixed label instead.
const currentStepLabel = computed(() => {
  const step = currentStep.value
  const pages = store.order?.journalPages ?? []
  const page = pages.find((p) => p.id === step?.journalPageId)
  if (!step || !page) {
    return ''
  }
  let spreadIndex = 0
  for (const p of pages) {
    if (p.slotType === 'SPREAD') {
      spreadIndex += 1
    }
    if (p.id === page.id) {
      break
    }
  }
  return getJournalPageDisplayName(page, spreadIndex)
})

const answersAsMap = computed<Map<string, QuestionAnswer>>(() => {
  const map = new Map<string, QuestionAnswer>()
  for (const [key, value] of Object.entries(answers)) {
    map.set(key, { questionKey: key, textValue: value.textValue, jsonValue: value.jsonValue })
  }
  return map
})

const questionByKey = computed(() => new Map(allQuestions.value.map((question) => [question.key, question])))

// Gates the bottom bar's "Продолжить" — vacuously true when there are no required questions (or
// no questions at all), so it's never stuck disabled for a page with nothing to require.
const allRequiredAnswered = computed(() =>
  allQuestions.value
    .filter((question) => question.isRequired)
    .every((question) => isQuestionAnswered(question, answersAsMap.value)),
)

// Bottom-bar pill next to "Продолжить" — a heads-up, not a gate (unlike `allRequiredAnswered`
// above): "Продолжить" still finishes the questionnaire either way, `finish()` itself is what
// opens MissingPhotosModal.vue if this is still non-zero at that point. Reuses the exact same
// check as that gate so the two never disagree about what counts as "missing".
const missingPhotoCount = computed(() =>
  countEmptyPhotoSlots(collectPhotoSlotPreview(store.order?.journalPages ?? [])),
)

const fillByPageId = computed(() => {
  const map = new Map<string, { answered: number; total: number }>()
  for (const [pageId, keys] of flow.value.pageQuestionKeys) {
    const answered = keys.filter((key) => {
      const question = questionByKey.value.get(key)
      return question ? isQuestionAnswered(question, answersAsMap.value) : false
    }).length
    map.set(pageId, { answered, total: keys.length })
  }
  return map
})

// Base layer — only from store.order (confirmed placeholderValues), recomputed whole only when a
// real autosave lands, not on every keystroke.
const baseCanvasByPageId = computed(() => {
  const map = new Map<string, ReturnType<typeof materializeCanvasData>>()
  for (const page of store.order?.journalPages ?? []) {
    map.set(page.id, materializeCanvasData(normalizeCanvasData(page.pageSnapshot), page.placeholderValues))
  }
  return map
})

// Pages touched by at least one not-yet-confirmed answer — typically 0-3 even mid-session (the
// pending set only holds answers whose save hasn't resolved yet), never all pages at once.
const overlayAffectedPageIds = computed<Set<string>>(() => {
  const set = new Set<string>()
  for (const key of Object.keys(pendingOverlayByKey)) {
    for (const pageId of flow.value.affectedPageIds.get(key) ?? []) {
      set.add(pageId)
    }
  }
  return set
})

function pendingOverridesForPage(pageId: string): Map<string, LocalPlaceholderDraft> {
  const overrides = new Map<string, LocalPlaceholderDraft>()
  const page = store.order?.journalPages.find((p) => p.id === pageId)
  if (!page) {
    return overrides
  }

  const leaves = flattenTree(normalizeCanvasData(page.pageSnapshot).elements)
  for (const leaf of leaves) {
    const leafKey = 'questionKey' in leaf ? leaf.questionKey : undefined
    const draft = leafKey ? pendingOverlayByKey[leafKey] : undefined
    if (draft) {
      overrides.set(leaf.id, {
        textValue: draft.textValue ?? undefined,
        jsonValue: draft.jsonValue ?? undefined,
      })
    }
  }
  return overrides
}

// Hot layer — only the few cards with an unconfirmed answer get the live draft overlaid on top of
// the base layer; everything else is served straight from the (already-memoized) base map. Stays
// correct across "answer, then immediately move to the next/previous question" because the
// overlay is keyed by answer, not by "which question is currently on screen" (see
// `pendingOverlayByKey`'s doc comment).
const canvasDataByPageId = computed(() => {
  const map = new Map(baseCanvasByPageId.value)

  for (const pageId of overlayAffectedPageIds.value) {
    const page = store.order?.journalPages.find((p) => p.id === pageId)
    const overrides = pendingOverridesForPage(pageId)
    if (!page || overrides.size === 0) {
      continue
    }
    map.set(
      pageId,
      materializeCanvasData(normalizeCanvasData(page.pageSnapshot), page.placeholderValues, overrides),
    )
  }
  return map
})

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const pulsingPageIds = ref<Set<string>>(new Set())
let pulseTimer: ReturnType<typeof setTimeout> | null = null
let focusOverrideTimer: ReturnType<typeof setTimeout> | null = null
const FOCUS_OVERRIDE_MS = 1800

function pulse(pageIds: Iterable<string>): void {
  if (pulseTimer) {
    clearTimeout(pulseTimer)
  }
  pulsingPageIds.value = new Set(pageIds)
  pulseTimer = setTimeout(() => {
    pulsingPageIds.value = new Set()
  }, 1500)
}

/** Steps within the questionnaire itself (own Далее/Пропустить/Назад row) — distinct from the
 * bottom bar's Назад/Продолжить below, which move between the order-creation steps. */
function advance(): void {
  if (currentIndex.value < totalSteps.value - 1) {
    currentIndex.value += 1
  }
}

function goNext(): void {
  const step = currentStep.value
  const wasAnswered = Boolean(
    step && step.questions.some((question) => isQuestionAnswered(question, answersAsMap.value)),
  )
  if (wasAnswered) {
    pulse(currentAffectedPageIds.value)
  }
  void flushAnswers()

  // Hold the book on the page just answered a beat longer than usual specifically when one of its
  // questions feeds an AI-text block — that block has no live-while-typing preview (see
  // canvasDataByPageId's overlay, which skips ai-text-placeholder on purpose), so the pulse/shimmer
  // here is the ONLY confirmation the answer did something; jumping to the next step's page in the
  // same instant (the normal, unheld behaviour) would hide it before the user ever sees it.
  const feedsAiText = Boolean(
    step && step.questions.some((question) => flow.value.aiTextElementsByQuestionKey.has(question.key)),
  )
  if (wasAnswered && feedsAiText) {
    focusOverridePageId.value = focusPageId.value
    if (focusOverrideTimer) {
      clearTimeout(focusOverrideTimer)
    }
    focusOverrideTimer = setTimeout(() => {
      focusOverridePageId.value = null
      focusOverrideTimer = null
    }, FOCUS_OVERRIDE_MS)
  }

  advance()
}

function clearFocusOverride(): void {
  if (focusOverrideTimer) {
    clearTimeout(focusOverrideTimer)
    focusOverrideTimer = null
  }
  focusOverridePageId.value = null
}

function goSkip(): void {
  clearFocusOverride()
  void flushAnswers()
  advance()
}

function goBack(): void {
  clearFocusOverride()
  if (currentIndex.value > 0) {
    currentIndex.value -= 1
  }
}

/** Bottom bar's "Назад" — always the previous order-creation step (Шаг 2, photo upload),
 * regardless of how far into the questionnaire the user is. */
function goToPreviousStep(): void {
  void router.push({ name: 'order-photo-upload', params: { orderId: orderId.value } })
}

const isFinishing = ref(false)
const submitErrorMessage = ref<string | null>(null)
const missingPhotosModalOpen = ref(false)

/** Waits for the last edit's save (and any AI generation it triggers) to actually land in
 * `store.order` before navigating to the review step — otherwise its book would mount from the
 * pre-generation snapshot and an AI-text block would appear empty until a manual page reload. The
 * missing-photos check happens right here, immediately after the questionnaire — not deferred to
 * the review step — so an incomplete journal gets caught at the earliest possible point instead of
 * only surfacing after the user has already clicked through to review it. JournalReviewPage.vue
 * still repeats the same check as a safety net right before checkout (its own crop/replace/edit
 * actions can't actually empty a slot, so it should never actually trigger there in practice —
 * other required-field validation and the guest-draft-to-order conversion live there instead,
 * since those are genuinely about the final checkout handoff). */
async function finish(): Promise<void> {
  if (isFinishing.value) {
    return
  }

  isFinishing.value = true
  try {
    await flushAnswers()

    const missingPhotoPages = collectPhotoSlotPreview(store.order?.journalPages ?? [])
    if (missingPhotoPages.some((page) => page.slots.some((slot) => !slot.url))) {
      missingPhotosModalOpen.value = true
      return
    }

    if (!store.order) {
      return
    }
    await router.push({ name: 'order-review', params: { orderId: store.order.id } })
  } finally {
    isFinishing.value = false
  }
}

/** MissingPhotosModal's own "Продолжить" — only shown once every slot it tracks is filled, so
 * re-running `finish()` here just falls through its now-satisfied photo check onto the review
 * navigation. */
function continueAfterPhotosFilled(): void {
  missingPhotosModalOpen.value = false
  void finish()
}

// ---------------------------------------------------------------------------
// AI-text manual edit / regenerate (hover icons on the book preview)
// ---------------------------------------------------------------------------

const aiTextEditModal = reactive<{
  open: boolean
  journalPageId: string | null
  elementId: string | null
  initialText: string
  lengthConstraint: LengthConstraint | null
  saving: boolean
}>({
  open: false,
  journalPageId: null,
  elementId: null,
  initialText: '',
  lengthConstraint: null,
  saving: false,
})

/** `canvasDataByPageId` already carries the real saved text (AI-generated or previously
 * overridden) on `previewPlaceholderText` — see mergeElementWithPlaceholderValue — so this reads
 * exactly what's on screen, no separate lookup against placeholderValues needed. */
function findAiTextLeaf(journalPageId: string, elementId: string): AiTextPlaceholder | null {
  const canvas = canvasDataByPageId.value.get(journalPageId)
  if (!canvas) {
    return null
  }
  const leaf = flattenTree(canvas.elements).find((item) => item.id === elementId)
  return leaf && isAiTextElement(leaf) ? leaf : null
}

function openAiTextEditor(journalPageId: string, elementId: string): void {
  const leaf = findAiTextLeaf(journalPageId, elementId)
  if (!leaf) {
    return
  }
  aiTextEditModal.journalPageId = journalPageId
  aiTextEditModal.elementId = elementId
  aiTextEditModal.initialText = leaf.previewPlaceholderText ?? ''
  aiTextEditModal.lengthConstraint = leaf.lengthConstraint
  aiTextEditModal.open = true
}

function closeAiTextEditor(): void {
  aiTextEditModal.open = false
}

async function saveAiTextEdit(text: string): Promise<void> {
  if (!aiTextEditModal.journalPageId || !aiTextEditModal.elementId) {
    return
  }

  aiTextEditModal.saving = true
  try {
    await store.savePlaceholders(aiTextEditModal.journalPageId, [
      { elementId: aiTextEditModal.elementId, valueType: 'TEXT', textValue: text },
    ])
    aiTextEditModal.open = false
  } catch {
    // orderError is set in the store — keep the modal open so the user can retry.
  } finally {
    aiTextEditModal.saving = false
  }
}

/** A fresh AI variant with the same feeding answers — see order-builder.store.ts's
 * `regenerateAiText`. Needs a real backend order (YandexGPT runs server-side), so a guest still on
 * a local draft gets a message instead of a silent no-op; the manual edit above works either way. */
async function handleRegenerateAiText(journalPageId: string, elementId: string): Promise<void> {
  if (store.isLocalDraft) {
    submitErrorMessage.value = 'Сначала сохраните заказ, чтобы сгенерировать новый вариант текста.'
    return
  }

  try {
    await store.regenerateAiText(journalPageId, elementId)
  } catch {
    submitErrorMessage.value = store.orderError ?? 'Не удалось сгенерировать новый вариант текста.'
  }
}

onMounted(() => {
  void load()
  window.addEventListener('beforeunload', handleBeforeUnload)

  mobileMediaQuery = window.matchMedia('(max-width: 767px)')
  updateIsMobileViewport()
  mobileMediaQuery.addEventListener('change', updateIsMobileViewport)
})

onUnmounted(() => {
  void flushAnswers()
  window.removeEventListener('beforeunload', handleBeforeUnload)
  mobileMediaQuery?.removeEventListener('change', updateIsMobileViewport)
  if (pulseTimer) {
    clearTimeout(pulseTimer)
  }
  if (focusOverrideTimer) {
    clearTimeout(focusOverrideTimer)
  }
})
</script>

<style scoped lang="scss">
.questionnaire-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-4;
  min-height: calc(100vh - 64px);
  color: $text-secondary;
  text-align: center;
}

.questionnaire-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  // White by default — only .questionnaire-page__book-column itself is grey (matching the
  // mockup, where the grey is scoped to the book's own perspective container, not the page
  // margins either side of the centered content on a wide viewport).
  background-color: $bg-elevated;
}

// ── Top bar — copied from CreateOrderPage.vue's .create-order__topbar for visual consistency ──
.questionnaire-page__topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 64px;
  flex-shrink: 0;
  background: rgba($bg-primary, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid $border-light;
}

.questionnaire-page__topbar-inner {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  @include page-container;
}

// Deliberately not the theme's `warning` color — that maps to a muted brown (see theme.ts, same
// reasoning as JournalStructurePanel.vue's own incomplete-badge) — this needs to read as a clear,
// warm amber notice at a glance. Opens MissingPhotosModal.vue on click.
.questionnaire-page__missing-photos-pill {
  display: inline-flex;
  align-items: center;
  gap: $spacing-1;
  padding: $spacing-2 $spacing-3;
  border: none;
  border-radius: 999px;
  background: #fceada;
  color: #c9762f;
  font-size: $font-size-body-sm;
  font-weight: $font-weight-medium;
  white-space: nowrap;
  cursor: pointer;
  transition: background 150ms ease;

  &:hover {
    background: #f8dcc0;
  }

  @include mobile-only {
    padding: 4px $spacing-3;
    font-size: $font-size-caption;
  }
}

// Overall progress through the 5-step order-creation flow (not this page's own question-answering
// progress — see .questionnaire-page__stats further down for that).
.questionnaire-page__step-progress {
  flex-shrink: 0;
}

.questionnaire-page__brand {
  font-family: $font-family-display;
  font-size: $font-size-body;
  font-weight: $font-weight-medium;
  letter-spacing: $letter-spacing-subheading;
  color: $text-primary;
  text-decoration: none;
  transition: opacity 200ms;

  &:hover {
    opacity: 0.65;
  }
}

.questionnaire-page__steps-label {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  color: $text-muted;
}

.questionnaire-page__steps-current {
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.questionnaire-page__steps-sep {
  margin-inline: 2px;
}

// ── Body: 3D book + main ─────────────────────────────────────────────────────
.questionnaire-page__body {
  flex: 1;
  min-height: 0;
  display: flex;
  // Clips the box-shadow "bleed" trick below — without this the 9999px shadows would widen the
  // page's own scrollable area instead of just visually reaching the viewport edge.
  overflow-x: hidden;
}

// Same container/max-width as .create-order__container and .questionnaire-page__actions-inner —
// keeps the book column's left edge flush with the bottom bar's "Назад" button instead of sitting
// further left than everything else on the page.
.questionnaire-page__body-inner {
  @include page-container;
  max-width: 1360px;
  margin-inline: auto;
  width: 100%;
  display: flex;
  align-items: stretch;
}

.questionnaire-page__book-column {
  position: relative;
  flex: 0 0 54%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-8;
  background: $bg-primary;
  border-right: 1px solid $border-light;

  // Bleeds the same grey past the book column's own left edge, all the way to the viewport edge
  // — the outer gutter left of the 1360px-capped content is "the journal side" too, not neutral
  // page background. `right: 100%` anchors flush to this column's own left edge regardless of
  // its actual width (a plain offset box-shadow, tried earlier, leaves a gap instead of
  // connecting seamlessly — this is the standard full-bleed-inside-a-boxed-layout technique).
  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    right: 100%;
    width: 100vw;
    background: $bg-primary;
  }

  @include mobile-only {
    display: none;
  }
}

// Same padding-block rhythm as .create-order__main, so the question screen reads as a direct
// continuation of Шаг 1 rather than a differently-paced page.
// Purely decorative — no overflow/scroll of its own. Giving THIS element overflow-y:auto (like
// the old, single-element version did) would force its computed overflow-x to auto too (CSS
// Overflow spec's "at least one non-visible" rule), which clips the ::after bleed below at this
// element's own right edge — reintroducing the white/grey gap the pseudo-element exists to close,
// AND turning the 100vw-wide pseudo-element into part of THIS element's scrollable area (a
// spurious horizontal scrollbar on the form). The actual scrolling now lives one level down, on
// .questionnaire-page__main-scroll, which has no bleed of its own and so is free to clip normally.
.questionnaire-page__main {
  position: relative;
  flex: 1;
  min-height: 0;
  background: $bg-elevated;

  // Bleeds the same white past the form column's own right edge, all the way to the viewport
  // edge — the outer gutter right of the 1360px-capped content is "the anketa side" too. See the
  // matching ::before on .questionnaire-page__book-column for why this uses a pseudo-element
  // instead of a box-shadow offset.
  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 100%;
    width: 100vw;
    background: $bg-elevated;
  }
}

.questionnaire-page__main-scroll {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-block: $spacing-8 $spacing-12;
  padding-inline: $spacing-6;

  @include mobile-only {
    padding-block: $spacing-6 160px;
  }
}

.questionnaire-page__container {
  max-width: 480px;
  margin-inline: auto;
  width: 100%;
}

.questionnaire-page__question {
  display: flex;
  flex-direction: column;
}

.questionnaire-page__stats {
  margin: 0;
  font-size: $font-size-caption;
  color: $text-secondary;
  white-space: nowrap;
}

// Same structure/classes as .create-order__intro (eyebrow/title/subtitle) — text-caption,
// text-h3, text-body are the project's own typography utility classes (styles/typography.scss).
.questionnaire-page__intro {
  margin-bottom: $spacing-6;

  @include mobile-only {
    margin-bottom: $spacing-6;
  }
}

.questionnaire-page__eyebrow {
  margin: 0 0 $spacing-2;
}

.questionnaire-page__title {
  margin: 0 0 $spacing-3;
}

.questionnaire-page__required {
  color: #e5484d;
}

.questionnaire-page__empty {
  color: $text-muted;
  text-align: center;
}

// One per question on the current step's page — several can stack in a single screen now (see
// QuestionnaireStep in questionnaire.util.ts), each with its own label/help text/field.
.questionnaire-page__field-group {
  margin-bottom: $spacing-6;

  @include mobile-only {
    margin-bottom: $spacing-4;
  }

  &:last-of-type {
    margin-bottom: 0;
  }
}

.questionnaire-page__field-label {
  display: block;
  font-weight: $font-weight-semibold;
  margin: 0 0 $spacing-2;
}

.questionnaire-page__field-help {
  max-width: 480px;
  margin: 0 0 $spacing-3;
}

// Own Далее/Пропустить/Назад for stepping between pages of the questionnaire.
.questionnaire-page__step-actions {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  margin-top: $spacing-6;
}

// ── Action bar — copied from CreateOrderPage.vue's .create-order__actions ────────────────────
.questionnaire-page__actions {
  position: relative;
  flex-shrink: 0;
  background: rgba($bg-elevated, 0.96);
  backdrop-filter: blur(12px);
  border-top: 1px solid $border-light;
  padding-block: $spacing-4;
}

// Floats right above the bar: the question-progress counter on the left, the missing-photos pill
// (when shown) on the right — the bar itself is too narrow to fit a 3-way row (Назад / pill /
// Продолжить) without overflowing on a phone.
.questionnaire-page__footer-float {
  @include page-container;
  max-width: 1360px;
  margin-inline: auto;
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $spacing-3;
  margin-bottom: $spacing-2;
}

.questionnaire-page__actions-inner {
  @include page-container;
  max-width: 1360px;
  margin-inline: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
}

.questionnaire-page__btn-back {
  min-width: 120px;
  letter-spacing: $letter-spacing-button;
  border-color: $border-default !important;
  text-transform: none;

  @include mobile-only {
    min-width: 96px;
  }
}

.questionnaire-page__btn-next {
  min-width: 180px;
  letter-spacing: $letter-spacing-button;
  text-transform: none;

  @include mobile-only {
    min-width: 140px;
  }
}
</style>
