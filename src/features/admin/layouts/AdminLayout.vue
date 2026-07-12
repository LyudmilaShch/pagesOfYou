<template>
  <div class="admin-layout">
    <!-- ── Mobile top bar ───────────────────────────────────────────────────── -->
    <header class="admin-topbar">
      <div class="admin-topbar__inner">
        <button
          class="admin-topbar__menu-btn"
          aria-label="Открыть меню"
          @click="drawerOpen = !drawerOpen"
        >
          <v-icon>mdi-menu</v-icon>
        </button>
        <span class="admin-topbar__title">Admin Portal</span>
        <button class="admin-topbar__logout" aria-label="Выйти" @click="handleLogout">
          <v-icon size="20">mdi-logout</v-icon>
        </button>
      </div>
    </header>

    <!-- ── Sidebar ───────────────────────────────────────────────────────────── -->
    <aside
      class="admin-sidebar"
      :class="{ 'admin-sidebar--open': drawerOpen }"
      aria-label="Навигация администратора"
    >
      <!-- Brand -->
      <div class="admin-sidebar__brand">
        <span class="admin-sidebar__brand-name">Pages of You</span>
        <span class="admin-sidebar__brand-badge">Admin</span>
      </div>

      <!-- Nav -->
      <nav class="admin-sidebar__nav">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="admin-sidebar__link"
          active-class="admin-sidebar__link--active"
          :aria-label="item.label"
          @click="drawerOpen = false"
        >
          <v-icon class="admin-sidebar__link-icon" size="18">{{ item.icon }}</v-icon>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <!-- Admin info + logout -->
      <div class="admin-sidebar__footer">
        <div class="admin-sidebar__user">
          <div class="admin-sidebar__user-avatar">
            <v-icon size="16" color="white">mdi-shield-account</v-icon>
          </div>
          <div class="admin-sidebar__user-info">
            <span class="admin-sidebar__user-email">{{ store.adminEmail }}</span>
            <span class="admin-sidebar__user-role">Administrator</span>
          </div>
        </div>
        <button
          class="admin-sidebar__logout-btn"
          :disabled="loggingOut"
          aria-label="Выйти"
          @click="handleLogout"
        >
          <v-icon size="16">mdi-logout</v-icon>
          Выйти
        </button>
      </div>
    </aside>

    <!-- Overlay for mobile -->
    <div
      v-if="drawerOpen"
      class="admin-sidebar__overlay"
      aria-hidden="true"
      @click="drawerOpen = false"
    />

    <!-- ── Main content ──────────────────────────────────────────────────────── -->
    <main class="admin-main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAdminAuthStore } from '../stores/admin-auth.store'

const store = useAdminAuthStore()
const router = useRouter()

const drawerOpen = ref(false)
const loggingOut = ref(false)

const navItems = [
  { to: '/admin/dashboard', icon: 'mdi-view-dashboard-outline', label: 'Dashboard' },
  { to: '/admin/magazine-types', icon: 'mdi-book-open-outline', label: 'Типы журналов' },
  { to: '/admin/photo-frames', icon: 'mdi-image-frame', label: 'Фоторамки' },
  { to: '/admin/orders', icon: 'mdi-package-variant-closed', label: 'Заказы' },
]

async function handleLogout(): Promise<void> {
  loggingOut.value = true
  try {
    await store.logout()
    await router.push('/admin/login')
  } finally {
    loggingOut.value = false
  }
}
</script>

<style scoped lang="scss">
$sidebar-width: 240px;
$topbar-height: 56px;

// ── Root layout ──────────────────────────────────────────────────────────────
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: $bg-primary;
}

// ── Top bar (mobile only) ────────────────────────────────────────────────────
.admin-topbar {
  display: flex;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: $topbar-height;
  background: $bg-elevated;
  border-bottom: 1px solid $border-light;
  z-index: 50;

  @include desktop-up {
    display: none;
  }

  &__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-inline: $spacing-4;
    width: 100%;
  }

  &__title {
    font-family: $font-family-display;
    font-size: $font-size-body;
    font-weight: $font-weight-medium;
    color: $text-primary;
  }

  &__menu-btn,
  &__logout {
    background: none;
    border: none;
    cursor: pointer;
    color: $text-primary;
    padding: $spacing-2;
    border-radius: $radius-sm;
    transition: background-color 150ms;

    &:hover {
      background: $state-hover-bg;
    }
  }
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
.admin-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: $sidebar-width;
  background: $bg-elevated;
  border-right: 1px solid $border-light;
  display: flex;
  flex-direction: column;
  z-index: 40;
  transform: translateX(-100%);
  transition: transform 250ms $ease-out-editorial;

  @include desktop-up {
    transform: translateX(0);
  }

  &--open {
    transform: translateX(0);
    box-shadow: $shadow-lg;
  }

  // Brand header
  &__brand {
    height: 64px;
    display: flex;
    align-items: center;
    gap: $spacing-2;
    padding-inline: $spacing-6;
    border-bottom: 1px solid $border-light;
    flex-shrink: 0;
  }

  &__brand-name {
    font-family: $font-family-display;
    font-size: $font-size-body-sm;
    font-weight: $font-weight-medium;
    letter-spacing: $letter-spacing-subheading;
    color: $text-primary;
  }

  &__brand-badge {
    font-family: $font-family-body;
    font-size: 10px;
    font-weight: $font-weight-semibold;
    letter-spacing: $letter-spacing-caption;
    text-transform: uppercase;
    color: $text-muted;
    background: $bg-tertiary;
    padding: 2px 6px;
    border-radius: $radius-xs;
  }

  // Navigation
  &__nav {
    flex: 1;
    padding: $spacing-3 $spacing-3;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
  }

  &__link {
    display: flex;
    align-items: center;
    gap: $spacing-3;
    padding: 10px $spacing-3;
    border-radius: $radius-sm;
    font-family: $font-family-body;
    font-size: $font-size-body-sm;
    font-weight: $font-weight-regular;
    color: $text-secondary;
    text-decoration: none;
    transition:
      background-color 150ms,
      color 150ms;

    &:hover {
      background: $state-hover-bg;
      color: $text-primary;
    }

    &--active {
      background: $black;
      color: $white;

      .admin-sidebar__link-icon {
        color: $white !important;
      }

      &:hover {
        background: $black;
        color: $white;
      }
    }
  }

  &__link-icon {
    flex-shrink: 0;
    transition: color 150ms;
  }

  // Footer
  &__footer {
    border-top: 1px solid $border-light;
    padding: $spacing-3 $spacing-4 $spacing-4;
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
    flex-shrink: 0;
  }

  &__user {
    display: flex;
    align-items: center;
    gap: $spacing-3;
  }

  &__user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: $black;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__user-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__user-email {
    font-size: $font-size-caption;
    font-weight: $font-weight-medium;
    color: $text-primary;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__user-role {
    font-size: 10px;
    color: $text-muted;
    letter-spacing: $letter-spacing-caption;
    text-transform: uppercase;
  }

  &__logout-btn {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    background: none;
    border: 1px solid $border-light;
    border-radius: $radius-sm;
    padding: 6px $spacing-3;
    font-family: $font-family-body;
    font-size: $font-size-caption;
    color: $text-secondary;
    cursor: pointer;
    transition:
      background-color 150ms,
      color 150ms,
      border-color 150ms;
    width: 100%;
    justify-content: center;

    &:hover {
      background: $state-hover-bg;
      color: $text-primary;
      border-color: $border-strong;
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  // Mobile overlay
  &__overlay {
    position: fixed;
    inset: 0;
    background: rgba($black, 0.4);
    z-index: 39;
    backdrop-filter: blur(2px);

    @include desktop-up {
      display: none;
    }
  }
}

// ── Main content area ────────────────────────────────────────────────────────
.admin-main {
  flex: 1;
  min-width: 0;
  padding-top: $topbar-height;

  @include desktop-up {
    padding-top: 0;
    margin-left: $sidebar-width;
  }
}
</style>
