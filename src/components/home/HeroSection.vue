<template>
  <section class="hero section-lg" aria-labelledby="hero-title">
    <div class="hero__overlay" aria-hidden="true" />

    <div class="hero__inner page-container">
      <div class="content-container hero__grid">
        <div class="hero__content">
          <p class="hero__eyebrow text-caption text-secondary animate-fade-in">
            Персональные издания
          </p>

          <h1 id="hero-title" class="hero__title text-h1 animate-fade-in-up">
            Журнал, главным героем которого станет близкий вам человек
          </h1>

          <p class="hero__subtitle text-body-lg text-secondary animate-fade-in-up">
            Сохраните важные воспоминания в красивом печатном журнале — уникальном подарке,
            который будут с теплом пересматривать спустя годы
          </p>

          <div class="hero__actions animate-fade-in-up">
            <v-btn
              color="primary"
              size="large"
              class="hero__btn text-button"
              :to="{ name: 'create-order' }"
            >
              Создать журнал
            </v-btn>
            <v-btn
              variant="outlined"
              color="primary"
              size="large"
              class="hero__btn hero__btn--secondary text-button"
              :to="{ path: '/', hash: '#examples' }"
            >
              Посмотреть примеры
            </v-btn>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts"></script>

<style scoped lang="scss">
.hero {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding-top: calc(#{$header-height} + #{$spacing-8});
  padding-bottom: $spacing-12;
  background-color: $bg-primary;
  background-image: url('/images/hero-bg.jpeg');
  background-size: cover;
  background-position: 72% center;
  background-repeat: no-repeat;

  @include tablet-up {
    padding-top: calc(#{$header-height} + #{$spacing-12});
    padding-bottom: $spacing-16;
    background-position: 78% center;
  }

  @include mobile-only {
    background-position: 80% center;
  }

  &__overlay {
    position: absolute;
    inset: 0;
    z-index: 0;
    background: linear-gradient(
      90deg,
      rgba($bg-primary, 0.94) 0%,
      rgba($bg-primary, 0.82) 38%,
      rgba($bg-primary, 0.35) 62%,
      rgba($bg-primary, 0.08) 100%
    );
    pointer-events: none;
  }

  &__inner {
    position: relative;
    z-index: 1;
    width: 100%;
  }

  &__grid {
    display: grid;
    align-items: center;

    @include desktop-up {
      grid-template-columns: 1fr 1fr;
    }
  }

  &__content {
    max-width: 560px;
  }

  &__eyebrow {
    margin-bottom: $spacing-4;
    animation-delay: 0ms;
  }

  &__title {
    margin-bottom: $spacing-6;
    animation-delay: 80ms;
  }

  &__subtitle {
    margin-bottom: $spacing-8;
    max-width: 560px;
    animation-delay: 160ms;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-3;
    animation-delay: 240ms;
  }

  &__btn {
    min-width: 180px;
    letter-spacing: $letter-spacing-button;

    &--secondary {
      border-color: $border-default !important;
      background-color: transparent !important;
    }
  }
}

.animate-fade-in,
.animate-fade-in-up {
  animation-duration: 280ms;
}
</style>
