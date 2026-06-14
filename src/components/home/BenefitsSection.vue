<template>
  <section
    ref="sectionRef"
    class="benefits section-md"
    :class="{ 'is-revealed': isRevealed }"
    aria-labelledby="benefits-title"
  >
    <div class="benefits__inner page-container">
      <div class="content-container">
        <header class="benefits__header mb-12">
          <p class="text-caption text-secondary mb-3">Преимущества</p>
          <h2 id="benefits-title" class="text-h2">Почему выбирают нас</h2>
        </header>

        <div class="benefits__grid">
          <article
            v-for="benefit in benefits"
            :key="benefit.title"
            class="benefits__item"
          >
            <v-icon :icon="benefit.icon" size="28" class="benefits__icon" />
            <h3 class="benefits__title text-h4">{{ benefit.title }}</h3>
            <p class="benefits__text text-body text-secondary">{{ benefit.description }}</p>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { homeBenefits } from '@/data/home.content'
import { useSectionReveal } from '@/composables/useSectionReveal'
import { ref } from 'vue'

const sectionRef = ref<HTMLElement | null>(null)
const { isRevealed } = useSectionReveal(sectionRef)

const benefits = homeBenefits
</script>

<style scoped lang="scss">
.benefits {
  @include section-reveal;
  scroll-margin-top: $header-height;

  &__grid {
    display: grid;
    gap: $spacing-8;

    @include tablet-up {
      grid-template-columns: repeat(2, 1fr);
      gap: $spacing-12 $spacing-8;
    }

    @include desktop-up {
      grid-template-columns: repeat(4, 1fr);
      gap: $spacing-6;
    }
  }

  &__item {
    padding-top: $spacing-6;
    border-top: 1px solid $divider;
  }

  &__icon {
    margin-bottom: $spacing-4;
    color: $text-primary;
    opacity: 0.72;
  }

  &__title {
    margin-bottom: $spacing-3;
  }

  &__text {
    max-width: 280px;
  }
}
</style>
