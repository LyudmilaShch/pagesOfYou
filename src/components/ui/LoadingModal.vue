<template>
  <Teleport to="body">
    <Transition name="loading-modal">
      <div v-if="modelValue" class="loading-modal" role="alert" aria-live="polite">
        <div class="loading-modal__panel">
          <v-progress-circular indeterminate color="primary" size="40" />
          <p class="loading-modal__text">{{ text }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean
    text?: string
  }>(),
  {
    text: 'Идет загрузка',
  },
)
</script>

<style scoped lang="scss">
// No close button and no @click.self dismissal, unlike BaseModal — this is a blocking wait
// state, not a dialog the user can back out of; whatever's loading finishes on its own and the
// caller flips `modelValue` off itself.
.loading-modal {
  position: fixed;
  inset: 0;
  // Same layer as BaseModal (above Vuetify's overlay stack) — a loading state can be shown while
  // a v-dialog/modal is already open (e.g. navigating away from one) and must still surface on top.
  z-index: 2500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-4;
  background-color: rgba($black, 0.55);
  backdrop-filter: blur(2px);
}

.loading-modal__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-4;
  padding: $spacing-8 $spacing-6;
  background-color: $bg-primary;
  border: 1px solid $border-default;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
}

.loading-modal__text {
  margin: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
  text-align: center;
}

.loading-modal-enter-active,
.loading-modal-leave-active {
  transition: opacity 200ms $ease-out-editorial;
}

.loading-modal-enter-from,
.loading-modal-leave-to {
  opacity: 0;
}
</style>
