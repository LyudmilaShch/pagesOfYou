<template>
  <section
    id="how-it-works"
    ref="sectionRef"
    class="how-it-works section-md"
    :class="{ 'is-revealed': isRevealed }"
    aria-labelledby="how-it-works-title"
  >
    <div class="how-it-works__inner page-container">
      <div class="content-container">
        <header class="how-it-works__header mb-12">
          <p class="text-caption text-secondary mb-3">Процесс</p>
          <h2 id="how-it-works-title" class="text-h2">Как это работает</h2>
        </header>

        <ol class="how-it-works__steps">
          <li
            v-for="step in steps"
            :key="step.number"
            class="how-it-works__step"
          >
            <span class="how-it-works__number text-caption">{{ step.number }}</span>
            <h3 class="how-it-works__step-title text-h4">{{ step.title }}</h3>
            <p class="how-it-works__step-text text-body text-secondary">{{ step.description }}</p>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { homeSteps } from '@/data/home.content'
import { useSectionReveal } from '@/composables/useSectionReveal'
import { ref } from 'vue'

const sectionRef = ref<HTMLElement | null>(null)
const { isRevealed } = useSectionReveal(sectionRef)

const steps = homeSteps
</script>

<style scoped lang="scss">
.how-it-works {
  @include section-reveal;
  scroll-margin-top: $header-height;
  border-top: 1px solid $divider;

  &__steps {
    display: grid;
    gap: $spacing-8;

    @include desktop-up {
      grid-template-columns: repeat(4, 1fr);
      gap: $spacing-6;
    }
  }

  &__step {
    padding-top: $spacing-6;
    border-top: 1px solid $border-default;
  }

  &__number {
    display: block;
    margin-bottom: $spacing-4;
    color: $text-muted;
  }

  &__step-title {
    margin-bottom: $spacing-3;
  }

  &__step-text {
    max-width: 280px;
  }
}
</style>
