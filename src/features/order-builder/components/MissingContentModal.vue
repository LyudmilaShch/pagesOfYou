<template>
  <BaseModal :model-value="open" labelledby="missing-content-title" @update:model-value="emit('close')">
    <div class="missing-content">
      <div class="missing-content__icon" aria-hidden="true">
        <v-icon size="28" color="white">mdi-alert-outline</v-icon>
      </div>

      <h2 id="missing-content-title" class="missing-content__title">Не хватает информации</h2>
      <p class="missing-content__subtitle">
        Прежде чем оформить заказ, заполните обязательные поля на этих страницах:
      </p>

      <div class="missing-content__list">
        <button
          v-for="page in pages"
          :key="page.journalPageId"
          type="button"
          class="missing-content__page"
          @click="emit('goToPage', page.journalPageId)"
        >
          <div class="missing-content__page-body">
            <span class="missing-content__page-label">{{ page.pageLabel }}</span>
            <span class="missing-content__page-missing">{{ page.missingLabels.join(', ') }}</span>
          </div>
          <v-icon size="18" color="textMuted">mdi-chevron-right</v-icon>
        </button>
      </div>

      <v-btn
        color="primary"
        variant="flat"
        class="missing-content__cta"
        :disabled="!pages.length"
        @click="goToFirstPage"
      >
        Перейти к заполнению
      </v-btn>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from '@/components/ui/BaseModal.vue'

const props = defineProps<{
  open: boolean
  pages: Array<{ journalPageId: string; pageLabel: string; missingLabels: string[] }>
}>()

const emit = defineEmits<{
  close: []
  goToPage: [journalPageId: string]
}>()

function goToFirstPage(): void {
  const firstPage = props.pages[0]
  if (firstPage) {
    emit('goToPage', firstPage.journalPageId)
  }
}
</script>

<style scoped lang="scss">
.missing-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-3;
  width: min(100%, 440px);
  margin-inline: auto;
  padding-top: $spacing-2;
  text-align: center;
}

.missing-content__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  flex-shrink: 0;
  border-radius: 9999px;
  background: $accent;
}

.missing-content__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.missing-content__subtitle {
  margin: 0;
  font-size: $font-size-body-sm;
  line-height: 1.5;
  color: $text-secondary;
}

.missing-content__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  width: 100%;
  max-height: 320px;
  overflow-y: auto;
  margin-top: $spacing-1;
}

.missing-content__page {
  display: flex;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-3;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.12s ease;

  &:hover {
    border-color: $accent;
  }
}

.missing-content__page-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.missing-content__page-label {
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  font-weight: $font-weight-medium;
  color: $text-primary;
}

.missing-content__page-missing {
  font-size: $font-size-caption;
  color: $text-muted;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.missing-content__cta {
  width: 100%;
  margin-top: $spacing-2;
  text-transform: none;
}
</style>
