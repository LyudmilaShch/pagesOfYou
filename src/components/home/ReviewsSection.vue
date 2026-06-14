<template>
  <section
    id="reviews"
    ref="sectionRef"
    class="reviews section-md"
    :class="{ 'is-revealed': isRevealed }"
    aria-labelledby="reviews-title"
  >
    <div class="reviews__inner page-container">
      <div class="content-container">
        <header class="reviews__header mb-12">
          <p class="text-caption reviews__eyebrow mb-3">Отзывы</p>
          <h2 id="reviews-title" class="text-h2 reviews__title">Отзывы клиентов</h2>
        </header>

        <div class="reviews__grid">
          <blockquote
            v-for="review in reviews"
            :key="review.id"
            class="reviews__card bg-elevated rounded-md"
          >
            <p class="reviews__quote text-body-lg">«{{ review.text }}»</p>

            <footer class="reviews__author">
              <div class="reviews__avatar rounded-full" aria-hidden="true">
                <span class="text-caption">{{ review.initials }}</span>
              </div>
              <div>
                <cite class="reviews__name text-body-sm">{{ review.name }}</cite>
                <p class="reviews__role text-caption text-secondary">{{ review.role }}</p>
              </div>
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { homeReviews } from '@/data/home.content'
import { useSectionReveal } from '@/composables/useSectionReveal'
import { ref } from 'vue'

const sectionRef = ref<HTMLElement | null>(null)
const { isRevealed } = useSectionReveal(sectionRef)

const reviews = homeReviews
</script>

<style scoped lang="scss">
.reviews {
  @include section-reveal;
  scroll-margin-top: $header-height;
  background-color: $text-primary;
  border-top: 1px solid $on-dark-border-subtle;

  &__title {
    color: $on-dark-text-emphasis;
  }

  &__eyebrow {
    color: $on-dark-text-muted;
  }

  &__grid {
    display: grid;
    gap: $spacing-6;

    @include desktop-up {
      grid-template-columns: repeat(3, 1fr);
      gap: $spacing-8;
    }
  }

  &__card {
    padding: $spacing-8;
    border: 1px solid $border-light;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 320px;
  }

  &__quote {
    margin-bottom: $spacing-8;
    color: $text-primary;
    font-style: normal;
    line-height: $line-height-body-lg;
  }

  &__author {
    display: flex;
    align-items: center;
    gap: $spacing-4;
  }

  &__avatar {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: $bg-secondary;
    border: 1px solid $border-default;
    color: $text-secondary;
    flex-shrink: 0;
  }

  &__name {
    display: block;
    font-style: normal;
    font-weight: $font-weight-medium;
    color: $text-primary;
  }

  &__role {
    margin-top: $spacing-1;
    font-style: normal;
  }
}
</style>
