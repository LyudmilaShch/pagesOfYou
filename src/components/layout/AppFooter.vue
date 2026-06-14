<template>
  <footer class="footer">
    <div class="footer__inner page-container section-sm">
      <div class="content-container footer__grid">
        <div class="footer__brand">
          <RouterLink to="/" class="footer__logo text-h4">Pages of you</RouterLink>
          <p class="footer__tagline text-body-sm text-secondary">
            Индивидуальные журналы
          </p>
        </div>

        <div class="footer__contacts">
          <p class="footer__label text-caption text-secondary mb-3">Контакты</p>
          <a href="tel:+79956244166" class="footer__link text-body-sm">
            +7 995 624-41-66
          </a>
          <p class="footer__link text-body-sm text-secondary">Ежедневно, 10:00–20:00</p>
        </div>
      </div>

      <div class="content-container footer__bottom">
        <p class="text-caption text-muted">
          © {{ currentYear }} Pages of you. Все права защищены.
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const currentYear = computed(() => new Date().getFullYear())
</script>

<style scoped lang="scss">
.footer {
  border-top: 1px solid $divider;
  background-color: $bg-primary;

  &__grid {
    display: grid;
    gap: $spacing-8;
    padding-bottom: $spacing-8;

    @include tablet-up {
      grid-template-columns: 2fr 1fr 1fr;
      gap: $spacing-12;
    }
  }

  &__logo {
    display: inline-block;
    font-family: $font-family-display;
    font-size: $font-size-h4;
    color: $text-primary;
    margin-bottom: $spacing-3;
  }

  &__tagline {
    max-width: 280px;
  }

  &__label {
    display: block;
  }

  &__link {
    display: block;
    color: $text-primary;
    margin-bottom: $spacing-2;
    transition: color 250ms ease;

    &:hover {
      color: $text-secondary;
    }
  }

  &__bottom {
    padding-top: $spacing-6;
    border-top: 1px solid $divider;
  }
}
</style>
