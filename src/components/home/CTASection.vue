<template>
  <section
    id="cta"
    ref="sectionRef"
    class="cta section-lg"
    :class="{ 'is-revealed': isRevealed }"
    aria-labelledby="cta-title"
  >
    <div class="cta__overlay" aria-hidden="true" />

    <div class="cta__inner page-container">
      <div class="content-container cta__content">
        <p class="text-caption text-secondary mb-4">Начните сегодня</p>

        <h2 id="cta-title" class="cta__title text-h1">
          Создайте свой журнал уже сегодня
        </h2>

        <p class="cta__subtitle text-body-lg text-secondary">
          Соберите важные моменты жизни в персональный журнал, который хочется пересматривать снова и снова. Это история о человеке, оформленная с вниманием к деталям и чувствам.
        </p>

        <v-btn
          color="primary"
          size="x-large"
          class="cta__btn text-button"
          :to="{ name: 'create-order' }"
        >
          Создать журнал
        </v-btn>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useSectionReveal } from '@/composables/useSectionReveal'
import { ref } from 'vue'

const sectionRef = ref<HTMLElement | null>(null)
const { isRevealed } = useSectionReveal(sectionRef)
</script>

<style scoped lang="scss">
.cta {
  @include section-reveal;
  scroll-margin-top: $header-height;
  position: relative;
  isolation: isolate;
  background-color: $bg-secondary;
  background-image: url('/images/CTASection-bg.jpeg');
  background-size: cover;
  background-position: center right;
  background-repeat: no-repeat;

  &__overlay {
    position: absolute;
    inset: 0;
    z-index: 0;
    background: linear-gradient(
      90deg,
      rgba($bg-secondary, 0.94) 0%,
      rgba($bg-secondary, 0.82) 42%,
      rgba($bg-secondary, 0.45) 100%
    );
  }

  &__inner {
    position: relative;
    z-index: 1;
  }

  &__content {
    max-width: 720px;
    text-align: center;
    margin-inline: auto;
  }

  &__title {
    margin-bottom: $spacing-6;

    @include mobile-only {
      font-size: $font-size-h2;
    }
  }

  &__subtitle {
    max-width: 560px;
    margin-inline: auto;
    margin-bottom: $spacing-8;
  }

  &__btn {
    min-width: 220px;
    letter-spacing: $letter-spacing-button;
  }
}
</style>
