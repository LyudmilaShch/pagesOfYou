<template>
  <v-app class="app-root">
    <router-view />
    <ErrorMessageModalHost />
  </v-app>
</template>

<script setup lang="ts">
import ErrorMessageModalHost from '@/components/ui/ErrorMessageModalHost.vue'
</script>

<style lang="scss">
.app-root.v-application {
  min-height: 100vh;
  height: auto;
}

.app-root .v-application__wrap {
  min-height: 100vh;
  height: auto;
}
</style>