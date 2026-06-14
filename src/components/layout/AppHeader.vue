<template>
  <header
    class="header"
    :class="{
      'header--scrolled': isScrolled,
      'header--home': isHomePage,
    }"
  >
    <div class="header__inner page-container">
      <div class="content-container header__bar">
        <RouterLink to="/" class="header__logo text-h4" @click="closeMenu">
          Pages of you
        </RouterLink>

        <nav class="header__nav" aria-label="Основная навигация">
          <button
            v-for="link in navLinks"
            :key="link.hash"
            type="button"
            class="header__nav-link text-body-sm"
            @click="navigateToSection(link.hash)"
          >
            {{ link.label }}
          </button>
        </nav>

        <div class="header__actions">
          <v-btn
            color="primary"
            class="header__cta text-button"
            size="default"
            :to="{ name: 'catalog' }"
          >
            Создать журнал
          </v-btn>

          <button
            type="button"
            class="header__burger"
            aria-label="Открыть меню"
            @click="isMenuOpen = true"
          >
            <v-icon icon="mdi-menu" size="24" />
          </button>
        </div>
      </div>
    </div>
  </header>

  <Teleport to="body">
    <v-navigation-drawer
      v-model="isMenuOpen"
      location="right"
      temporary
      width="300"
      class="header__drawer"
    >
      <div class="header__drawer-content">
        <nav class="header__drawer-nav" aria-label="Мобильная навигация">
          <button
            v-for="link in navLinks"
            :key="link.hash"
            type="button"
            class="header__drawer-link text-body"
            @click="navigateToSection(link.hash)"
          >
            {{ link.label }}
          </button>
        </nav>

        <v-btn
          color="primary"
          size="large"
          class="header__drawer-cta text-button"
          :to="{ name: 'catalog' }"
          @click="closeMenu"
        >
          Создать журнал
        </v-btn>
      </div>
    </v-navigation-drawer>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { scrollToSection } from '@/utils/scroll'

interface NavLink {
  label: string
  hash: string
}

const navLinks: NavLink[] = [
  { label: 'Как это работает', hash: '#how-it-works' },
  { label: 'Примеры', hash: '#examples' },
  { label: 'Отзывы', hash: '#reviews' },
  { label: 'FAQ', hash: '#faq' },
]

const route = useRoute()
const router = useRouter()
const isMenuOpen = ref(false)
const isScrolled = ref(false)
const isHomePage = computed(() => route.path === '/')

function closeMenu() {
  isMenuOpen.value = false
}

async function navigateToSection(hash: string) {
  closeMenu()

  if (route.path !== '/') {
    await router.push({ path: '/', hash })
    return
  }

  if (route.hash !== hash) {
    await router.replace({ path: '/', hash })
    return
  }

  scrollToSection(hash)
}

function onScroll() {
  isScrolled.value = window.scrollY > 8
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<style scoped lang="scss">
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 100;
  height: $header-height;
  background-color: transparent;
  border-bottom: 1px solid transparent;
  transition:
    border-color 250ms ease,
    box-shadow 250ms ease;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: $bg-primary;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    pointer-events: none;
    transition: background 250ms ease;
  }

  &--scrolled {
    border-bottom-color: rgba($black, 0.08);
    box-shadow: $shadow-xs;

    &::before {
      background: rgba($black, 0.12);
    }
  }

  &--home:not(.header--scrolled)::before {
    background: rgba($black, 0.06);
  }

  &:not(.header--home)::before {
    background: $bg-primary;
  }

  &__inner {
    position: relative;
    z-index: 1;
  }

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: $header-height;
    gap: $spacing-4;
  }

  &__logo {
    font-family: $font-family-display;
    font-size: $font-size-h4;
    font-weight: $font-weight-regular;
    color: $text-primary;
    white-space: nowrap;
    flex-shrink: 0;
  }

  &__nav {
    display: none;
    align-items: center;
    gap: $spacing-6;

    @include desktop-up {
      display: flex;
    }
  }

  &__nav-link {
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    color: $text-secondary;
    transition: color 250ms ease;

    &:hover {
      color: $text-primary;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: $spacing-2;
  }

  &__cta {
    display: none;
    letter-spacing: $letter-spacing-button;

    @include desktop-up {
      display: inline-flex;
    }
  }

  &__burger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid rgba($black, 0.12);
    border-radius: $radius-sm;
    background: $on-dark-surface-soft;
    color: $text-primary;
    cursor: pointer;
    transition:
      background-color 250ms ease,
      border-color 250ms ease;

    &:hover {
      background-color: $on-dark-surface-medium;
      border-color: rgba($black, 0.18);
    }

    @include desktop-up {
      display: none;
    }
  }

  &__drawer-content {
    padding: $spacing-8 $spacing-6;
    display: flex;
    flex-direction: column;
    gap: $spacing-8;
  }

  &__drawer-cta {
    width: 100%;
    flex: 0 0 auto;
  }

  &__drawer-nav {
    display: flex;
    flex-direction: column;
    gap: $spacing-4;
  }

  &__drawer-link {
    padding: 0;
    padding-block: $spacing-2;
    border: none;
    border-bottom: 1px solid $divider;
    background: none;
    text-align: left;
    cursor: pointer;
    color: $text-primary;
  }
}

:deep(.header__drawer) {
  background-color: $bg-primary !important;
}
</style>

<style lang="scss">
.header__drawer.v-navigation-drawer {
  z-index: 1100 !important;
}

.header__drawer.v-navigation-drawer ~ .v-navigation-drawer__scrim {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1099;
}
</style>
