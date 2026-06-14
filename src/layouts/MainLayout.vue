<template>
  <div class="main-layout" :class="{ 'main-layout--home': isHomePage }">
    <AppHeader />
    <main class="main-layout__content">
      <router-view />
    </main>
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AppFooter from '@/components/layout/AppFooter.vue'
import AppHeader from '@/components/layout/AppHeader.vue'

const route = useRoute()
const isHomePage = computed(() => route.path === '/')
</script>

<style scoped lang="scss">
.main-layout {
  display: flex;
  flex-direction: column;

  &__content {
    padding-top: $header-height;
    min-height: 100vh;
  }

  &--home &__content {
    padding-top: 0;
  }
}
</style>
