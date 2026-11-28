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
          :class="{
            'base-modal__panel--fit-viewport': fitViewport,
            'base-modal__panel--fill-mobile': fillMobile,
            'base-modal__panel--wide': wide,
            'base-modal__panel--narrow': narrow,
            'base-modal__panel--bare': bare,
          }"
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

<script lang="ts">
/** Shared across every open modal so closing one does not unlock the page while another remains. */
let bodyLockCount = 0
let lockedScrollY = 0

export function lockBodyScroll(): void {
  if (bodyLockCount === 0) {
    lockedScrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${lockedScrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
  }
  bodyLockCount += 1
}

export function unlockBodyScroll(): void {
  bodyLockCount = Math.max(0, bodyLockCount - 1)
  if (bodyLockCount > 0) {
    return
  }
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.left = ''
  document.body.style.right = ''
  document.body.style.width = ''
  document.body.style.overflow = ''
  window.scrollTo(0, lockedScrollY)
}
</script>

<script setup lang="ts">
import { onUnmounted, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  labelledby?: string
  fitViewport?: boolean
  /** On a phone, the panel fills the viewport so an inner list can scroll while a footer stays put. */
  fillMobile?: boolean
  /** Raises the panel's max-width from 960px to 1200px — for content that's cramped at the
   * default size (e.g. a two-column layout with a live preview), rather than every modal. */
  wide?: boolean
  /** Lowers the panel's max-width from 960px to 420px — for short, single-column notices (an
   * icon, a line or two of text, stacked buttons) that otherwise sit lost in a mostly-empty
   * 960px-wide box. Takes precedence if both `wide` and `narrow` are somehow set. */
  narrow?: boolean
  /** No panel chrome of its own (background, border, padding) — for content that is already a
   * self-contained card (e.g. AuthForm), which would otherwise sit framed inside a second box. */
  bare?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

watch(
  () => props.modelValue,
  (open, wasOpen) => {
    if (open) {
      lockBodyScroll()
    } else if (wasOpen) {
      unlockBodyScroll()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  if (props.modelValue) {
    unlockBodyScroll()
  }
})

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
  // Above Vuetify's v-dialog/v-overlay stack (typically ~2000-2400 with nested overlays),
  // so error/info modals always surface on top of any open dialog.
  z-index: 2500;
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

    &--fill-mobile {
      @include mobile-only {
        height: calc(100dvh - #{$spacing-4} * 2);
      }
    }

    &--wide {
      width: min(100%, 1200px);
    }

    &--narrow {
      width: min(100%, 420px);
    }

    &--bare {
      width: min(100%, 440px);
      padding: 0;
      overflow: visible;
      background-color: transparent;
      border: none;
      box-shadow: none;

      @include tablet-up {
        padding: 0;
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

<style lang="scss">
// One mobile title size for every BaseModal. Beats each modal's own scoped heading size.
@include mobile-only {
  .base-modal .base-modal__panel :is(h1, h2) {
    font-size: 16px;
    line-height: 1.2;
    margin-bottom: 4px;
  }

  // These stacks already separate children with flex gap. Keep that gap above the title,
  // and leave 4px between the title and the block under it.
  .base-modal .base-modal__panel :is(
    .confirm-modal,
    .incomplete-photos,
    .missing-content,
    .error-message-modal
  ) > :is(h1, h2) {
    margin-bottom: 0;
  }

  .base-modal .base-modal__panel :is(
    .confirm-modal,
    .incomplete-photos,
    .missing-content
  ) > :is(h1, h2) + * {
    margin-top: -8px;
  }

  .base-modal .base-modal__panel .error-message-modal > :is(h1, h2) + * {
    margin-top: -4px;
  }
}
</style>
