<template>
  <section
    id="examples"
    ref="sectionRef"
    class="examples section-md"
    :class="{ 'is-revealed': isRevealed }"
    aria-labelledby="examples-title"
  >
    <div class="examples__inner page-container">
      <div class="content-container">
        <header class="examples__intro mb-12">
          <h2 id="examples-title" class="text-h2 mb-4">Примеры журналов</h2>
          <p class="examples__subtitle text-body-lg text-secondary">
            Каждый журнал создаётся индивидуально из ваших фотографий, историй и воспоминаний.
          </p>
        </header>
      </div>

      <div class="examples__gallery-wrap">
        <div
          class="examples__gallery-frame"
          role="list"
          aria-label="Галерея примеров журналов"
        >
          <div
            v-for="column in galleryColumns"
            :key="column.id"
            class="examples__column"
            :style="getColumnStyle(column)"
            role="presentation"
          >
            <article
              v-for="(slot, index) in column.slots"
              :key="`${column.id}-${index}`"
              class="examples__card"
              role="listitem"
              tabindex="0"
              :aria-label="slot.example.title"
            >
              <div class="examples__cover">
                <div
                  class="examples__cover-image"
                  :style="getCoverImageStyle(slot.image)"
                  aria-hidden="true"
                />
                <div class="examples__cover-overlay">
                  <div class="examples__cover-content">
                    <h3 class="examples__cover-title">{{ slot.example.title }}</h3>
                    <p class="examples__cover-caption">{{ slot.example.category }}</p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  homeExamples,
  homeGalleryColumns,
  type HomeExample,
  type HomeGalleryColumn,
} from '@/data/home.content'
import { useSectionReveal } from '@/composables/useSectionReveal'
import { computed, ref } from 'vue'

interface ResolvedGallerySlot {
  image: string
  example: HomeExample
}

interface ResolvedGalleryColumn extends HomeGalleryColumn {
  slots: [ResolvedGallerySlot, ResolvedGallerySlot]
}

const sectionRef = ref<HTMLElement | null>(null)
const { isRevealed } = useSectionReveal(sectionRef)

const examplesById = new Map(homeExamples.map((example) => [example.id, example]))

const galleryColumns = computed<ResolvedGalleryColumn[]>(() =>
  homeGalleryColumns.map((column) => ({
    ...column,
    slots: column.slots.map((slot) => ({
      image: slot.image,
      example: examplesById.get(slot.exampleId) ?? homeExamples[0],
    })) as [ResolvedGallerySlot, ResolvedGallerySlot],
  })),
)

function getColumnStyle(column: ResolvedGalleryColumn) {
  return {
    '--col-top': column.topRatio,
    '--col-bottom': column.bottomRatio,
  }
}

function getCoverImageStyle(image: string) {
  return {
    backgroundImage: `url('${image}')`,
  }
}
</script>

<style scoped lang="scss">
.examples {
  @include section-reveal;
  scroll-margin-top: $header-height;
  position: relative;
  overflow: hidden;
  background-color: $bg-secondary;
  border-block: 1px solid $divider;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.35;
    background-image:
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 119px,
        rgba($black, 0.04) 119px,
        rgba($black, 0.04) 120px
      );
  }

  &__inner {
    position: relative;
    z-index: 1;
  }

  &__intro {
    max-width: 560px;
  }

  &__subtitle {
    max-width: 520px;
  }

  &__gallery-wrap {
    padding-inline: $container-padding-mobile;

    @include tablet-up {
      padding-inline: $container-padding-tablet;
    }

    @include desktop-up {
      padding-inline: $container-padding-desktop;
    }

    @include wide-up {
      padding-inline: $container-padding-wide;
    }
  }

  &__gallery-frame {
    display: flex;
    gap: $spacing-3;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    border-radius: $radius-xl;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    @include desktop-up {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: $spacing-3;
      max-width: $container-max-width-desktop;
      margin-inline: auto;
      overflow: visible;
      scroll-snap-type: none;
    }

    @include wide-up {
      max-width: $container-max-width-wide;
      gap: $spacing-3;
    }
  }

  &__column {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
    flex: 0 0 min(42vw, 168px);
    height: 420px;
    scroll-snap-align: center;

    @include tablet-up {
      flex-basis: min(28vw, 200px);
      height: 480px;
      scroll-snap-align: start;
    }

    @include desktop-up {
      flex: unset;
      height: 520px;
      scroll-snap-align: none;
    }

    @include wide-up {
      height: 580px;
    }
  }

  &__card {
    position: relative;
    flex: var(--col-top, 1) 1 0;
    min-height: 0;
    cursor: pointer;
    overflow: hidden;
    border-radius: $radius-md;
    outline: none;

    & + & {
      flex: var(--col-bottom, 1) 1 0;
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  &__cover {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: inherit;
  }

  &__cover-image {
    position: absolute;
    inset: 0;
    background-color: $bg-tertiary;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    transition: transform 500ms $ease-out-editorial;
  }

  &__cover-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    align-items: flex-end;
    padding: $spacing-4;
    background-color: rgba($black, 0);
    transition: background-color 280ms $ease-out-editorial;

    @include desktop-up {
      padding: $spacing-6;
    }
  }

  &__cover-content {
    width: 100%;
    opacity: 0;
    transform: translateY(8px);
    transition:
      opacity 280ms $ease-out-editorial,
      transform 280ms $ease-out-editorial;
  }

  &__cover-title {
    font-family: $font-family-display;
    font-size: clamp(0.9375rem, 1.1vw, 1.125rem);
    font-weight: 500;
    line-height: 1.15;
    letter-spacing: $letter-spacing-subheading;
    color: $on-dark-text-primary;
    margin-bottom: $spacing-1;
  }

  &__cover-caption {
    font-family: $font-family-body;
    font-size: $font-size-body-sm;
    line-height: 1.4;
    letter-spacing: 0.04em;
    color: $on-dark-text-secondary;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (hover: hover) {
    &__card:hover {
      .examples__cover-image {
        transform: scale(1.05);
      }

      .examples__cover-overlay {
        background-color: rgba($black, 0.4);
      }

      .examples__cover-content {
        opacity: 1;
        transform: translateY(0);
      }
    }
  }

  &__card:focus-within {
    .examples__cover-overlay {
      background-color: rgba($black, 0.4);
    }

    .examples__cover-content {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
</style>
