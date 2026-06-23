<template>
  <Teleport to="body">
    <Transition name="base-modal">
      <div
        v-if="modelValue"
        class="base-modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="labelledby"
        @click.self="handleOverlayClick"
      >
        <div
          class="base-modal__panel"
          :class="{ 'base-modal__panel--fit-viewport': fitViewport }"
        >
          <button
            type="button"
            class="base-modal__close"
            aria-label="Закрыть"
            @click="close"
          >
            <span aria-hidden="true">&times;</span>
          </button>

          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
  labelledby?: string
  fitViewport?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const close = () => {
  emit('update:modelValue', false)
}

const handleOverlayClick = () => {
  close()
}
</script>

<style scoped lang="scss">
.base-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-4;
  background-color: rgba($black, 0.55);
  backdrop-filter: blur(2px);

  @include tablet-up {
    padding: $spacing-6;
  }

  &__panel {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(100%, 960px);
    max-height: calc(100dvh - #{$spacing-4} * 2);
    overflow: hidden;
    padding: $spacing-6 $spacing-4 $spacing-4;
    background-color: $bg-primary;
    border: 1px solid $border-default;
    border-radius: $radius-lg;
    box-shadow: $shadow-lg;

    @include tablet-up {
      padding: $spacing-8 $spacing-6 $spacing-6;
      max-height: calc(100dvh - #{$spacing-6} * 2);
    }

    &--fit-viewport {
      height: calc(100dvh - #{$spacing-4} * 2);

      @include tablet-up {
        height: calc(100dvh - #{$spacing-6} * 2);
      }
    }
  }

  &__close {
    position: absolute;
    top: $spacing-3;
    right: $spacing-3;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: none;
    border-radius: 9999px;
    background-color: transparent;
    color: $text-secondary;
    font-size: 1.75rem;
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
}

.base-modal-enter-active,
.base-modal-leave-active {
  transition: opacity 280ms $ease-out-editorial;

  .base-modal__panel {
    transition: transform 280ms $ease-out-editorial;
  }
}

.base-modal-enter-from,
.base-modal-leave-to {
  opacity: 0;

  .base-modal__panel {
    transform: scale(0.96);
  }
}
</style>
