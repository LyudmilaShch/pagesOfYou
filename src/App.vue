<template>
  <v-app class="app-root">
    <DraftTabWarning />
    <router-view />
    <ErrorMessageModalHost />
  </v-app>
</template>

<script setup lang="ts">
import ErrorMessageModalHost from '@/components/ui/ErrorMessageModalHost.vue'
import DraftTabWarning from '@/features/order-builder/components/DraftTabWarning.vue'
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

// DraftTabWarning.vue publishes --draft-tab-warning-height while the other-tab notice is showing.
// These screens are built to fill the viewport exactly; without giving that height back, the
// banner pushes them past the window and the document starts scrolling.
html.draft-tab-warning-open {
  .questionnaire-page,
  .photo-upload-page {
    height: calc(100vh - var(--draft-tab-warning-height, 0px));
    overflow: hidden;
  }

  .create-order,
  .checkout-page,
  .account-page,
  .editor-layout {
    min-height: calc(100vh - var(--draft-tab-warning-height, 0px));
  }

  // The review step is a fixed viewport on every width (the journal fills what's left). Subtract
  // the banner there too, or the page is exactly one screen PLUS the banner and scrolls again.
  .journal-review-page {
    height: calc(100vh - var(--draft-tab-warning-height, 0px));
    height: calc(100dvh - var(--draft-tab-warning-height, 0px));
    min-height: 0;
    overflow: hidden;
  }

  @include mobile-only {
    .editor-layout {
      height: calc(100dvh - var(--draft-tab-warning-height, 0px));
      min-height: 0;
    }
  }
}
</style>