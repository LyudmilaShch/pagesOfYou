<template>
  <section
    id="faq"
    ref="sectionRef"
    class="faq section-md"
    :class="{ 'is-revealed': isRevealed }"
    aria-labelledby="faq-title"
  >
    <div class="faq__inner page-container">
      <div class="content-container faq__layout">
        <header class="faq__header">
          <p class="text-caption text-secondary mb-3">Вопросы</p>
          <h2 id="faq-title" class="text-h2">Часто задаваемые вопросы</h2>
        </header>

        <v-expansion-panels
          v-model="openedPanel"
          variant="accordion"
          class="faq__panels"
        >
          <v-expansion-panel
            v-for="(item, index) in faqItems"
            :key="item.question"
            :value="index"
            class="faq__panel"
            elevation="0"
            rounded="lg"
          >
            <v-expansion-panel-title class="faq__question text-body">
              {{ item.question }}
            </v-expansion-panel-title>
            <v-expansion-panel-text class="faq__answer text-body text-secondary">
              {{ item.answer }}
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { homeFaqItems } from '@/data/home.content'
import { useSectionReveal } from '@/composables/useSectionReveal'
import { ref } from 'vue'

const sectionRef = ref<HTMLElement | null>(null)
const { isRevealed } = useSectionReveal(sectionRef)

const faqItems = homeFaqItems
const openedPanel = ref<number | undefined>(0)
</script>

<style scoped lang="scss">
.faq {
  @include section-reveal;
  scroll-margin-top: $header-height;
  border-top: 1px solid $divider;

  &__layout {
    display: grid;
    gap: $spacing-8;

    @include desktop-up {
      grid-template-columns: 1fr 1.4fr;
      gap: $spacing-16;
      align-items: start;
    }
  }

  &__header {
    max-width: 400px;
  }

  &__panels {
    background: transparent;
  }

  &__panel {
    margin-bottom: $spacing-2;
    border: 1px solid $border-light;
    background-color: $bg-elevated !important;

    &::before {
      box-shadow: none !important;
    }
  }

  &__question {
    font-weight: $font-weight-medium;
    padding-block: $spacing-4;
  }

  &__answer {
    padding-bottom: $spacing-4;
    line-height: $line-height-body-lg;
  }
}
</style>
