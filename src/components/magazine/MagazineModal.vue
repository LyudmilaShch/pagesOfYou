<template>
  <BaseModal
    :model-value="modelValue"
    :labelledby="titleId"
    fit-viewport
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="magazine-modal">
      <header class="magazine-modal__header">
        <p class="magazine-modal__eyebrow">Пример работы</p>
        <h2 :id="titleId" class="magazine-modal__title text-h3">{{ magazine.recipient }}</h2>
        <p class="magazine-modal__occasion text-body">{{ magazine.occasion }}</p>
      </header>

      <Transition name="magazine-hint">
        <div v-if="isHintVisible" class="magazine-modal__hint" role="status">
          <span class="magazine-modal__hint-icon" aria-hidden="true">↔</span>
          <p class="magazine-modal__hint-text">
            Листайте журнал — нажимайте на края страниц или проведите пальцем
          </p>
          <button
            type="button"
            class="magazine-modal__hint-close"
            aria-label="Скрыть подсказку"
            @click="dismissHint"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      </Transition>

      <div class="magazine-modal__flipbook">
        <MagazineFlipbook />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from '@/components/ui/BaseModal.vue'
import MagazineFlipbook from '@/components/magazine/MagazineFlipbook.vue'
import type { MagazineData } from '@/composables/useMagazineModal'
import { useFlipHint } from '@/composables/useFlipHint'
import { useId } from 'vue'

const props = defineProps<{
  modelValue: boolean
  magazine: MagazineData
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const titleId = useId()
const { isHintVisible, dismissHint } = useFlipHint(() => props.modelValue)
</script>

<style scoped lang="scss">
.magazine-modal {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: 100%;

  &__header {
    flex-shrink: 0;
    padding-right: $spacing-8;
    margin-bottom: $spacing-4;
    text-align: center;
  }

  &__eyebrow {
    margin-bottom: $spacing-1;
    font-family: $font-family-body;
    font-size: $font-size-body-sm;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: $text-muted;
  }

  &__title {
    margin-bottom: $spacing-1;
  }

  &__occasion {
    color: $text-secondary;
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: $spacing-3;
    flex-shrink: 0;
    margin-bottom: $spacing-4;
    padding: $spacing-3 $spacing-4;
    background-color: $bg-elevated;
    border: 1px solid $border-default;
    border-radius: $radius-md;
    box-shadow: $shadow-sm;
  }

  &__hint-icon {
    flex-shrink: 0;
    font-size: 1.125rem;
    line-height: 1;
    color: $text-muted;
  }

  &__hint-text {
    flex: 1;
    margin: 0;
    font-family: $font-family-body;
    font-size: $font-size-body-sm;
    line-height: 1.45;
    color: $text-secondary;
  }

  &__hint-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    border-radius: 9999px;
    background-color: transparent;
    color: $text-muted;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    transition:
      background-color 200ms $ease-out-editorial,
      color 200ms $ease-out-editorial;

    &:hover {
      background-color: $bg-tertiary;
      color: $text-primary;
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  &__flipbook {
    flex: 1;
    min-height: 0;
    width: 100%;
    overflow: hidden;
  }
}

.magazine-hint-enter-active,
.magazine-hint-leave-active {
  transition:
    opacity 220ms $ease-out-editorial,
    transform 220ms $ease-out-editorial;
}

.magazine-hint-enter-from,
.magazine-hint-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
