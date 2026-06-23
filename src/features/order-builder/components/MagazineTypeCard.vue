<template>
  <article
    class="magazine-card"
    :class="{ 'magazine-card--selected': isSelected }"
    role="radio"
    :aria-checked="isSelected"
    :aria-label="type.name"
    tabindex="0"
    @click="$emit('select', type)"
    @keydown.enter.prevent="$emit('select', type)"
    @keydown.space.prevent="$emit('select', type)"
  >
    <!-- Cover image (3:4 ratio) -->
    <div class="magazine-card__cover">
      <div
        class="magazine-card__image"
        :style="{ backgroundImage: `url('${type.image}')` }"
        role="img"
        :aria-label="type.name"
      />

      <!-- Marketing badge — top-left -->
      <transition name="type-badge">
        <div
          v-if="displayBadgeText"
          :class="['magazine-card__type-badge', `magazine-card__type-badge--${(type.badgeType ?? '').toLowerCase()}`]"
          aria-hidden="true"
        >
          {{ displayBadgeText }}
        </div>
      </transition>

      <!-- Selected check badge — top-right -->
      <transition name="badge">
        <div v-if="isSelected" class="magazine-card__sel-badge" aria-hidden="true">
          <v-icon size="16" color="white">mdi-check</v-icon>
        </div>
      </transition>
    </div>

    <!-- Text -->
    <div class="magazine-card__body">
      <h3 class="magazine-card__name">{{ type.name }}</h3>
      <p class="magazine-card__description">{{ type.description }}</p>

      <!-- Price block -->
      <div v-if="type.basePrice" class="magazine-card__price-block">
        <!-- With old price: strikethrough + discount -->
        <template v-if="type.oldPrice">
          <div class="magazine-card__price-row">
            <span class="magazine-card__old-price">{{ formatPrice(type.oldPrice) }}</span>
            <span v-if="discountPercent" class="magazine-card__discount">−{{ discountPercent }}%</span>
          </div>
          <span class="magazine-card__price magazine-card__price--sale">
            {{ formatPrice(type.basePrice) }}
          </span>
        </template>

        <!-- Without old price: just the price -->
        <template v-else>
          <span class="magazine-card__price">{{ formatPrice(type.basePrice) }}</span>
        </template>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MagazineType, BadgeType } from '../types/magazine-type'

interface Props {
  type: MagazineType
  isSelected?: boolean
}

const props = withDefaults(defineProps<Props>(), { isSelected: false })
defineEmits<{ select: [type: MagazineType] }>()

// ── Badge ─────────────────────────────────────────────────────────────────────

const BADGE_LABELS: Record<BadgeType, string> = {
  TOP: 'Топ продаж',
  NEW: 'Новинка',
  SALE: 'Скидка',
  POPULAR: 'Популярный',
  LIMITED: 'Ограниченная серия',
}

const displayBadgeText = computed<string | null>(() => {
  if (!props.type.badgeType && !props.type.badgeText) return null
  return props.type.badgeText || (props.type.badgeType ? BADGE_LABELS[props.type.badgeType] : null)
})

// ── Price ─────────────────────────────────────────────────────────────────────

const discountPercent = computed<number | null>(() => {
  if (!props.type.oldPrice || !props.type.basePrice) return null
  const pct = Math.round((1 - props.type.basePrice / props.type.oldPrice) * 100)
  return pct > 0 ? pct : null
})

const priceFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'decimal',
  maximumFractionDigits: 0,
})

function formatPrice(value: number): string {
  return `${priceFormatter.format(value)} ₽`
}
</script>

<style scoped lang="scss">
.magazine-card {
  display: flex;
  flex-direction: column;
  background: $bg-elevated;
  border-radius: $radius-md;
  border: 1.5px solid $border-light;
  box-shadow: $shadow-sm;
  cursor: pointer;
  outline: none;
  transition:
    transform 300ms $ease-out-editorial,
    box-shadow 300ms $ease-out-editorial,
    border-color 200ms $ease-out-editorial;
  user-select: none;
  overflow: hidden;

  // Hover
  @media (hover: hover) {
    &:hover {
      transform: translateY(-4px);
      box-shadow: $shadow-lg;
      border-color: $border-strong;
    }
  }

  // Focus
  &:focus-visible {
    @include focus-ring;
  }

  // Selected
  &--selected {
    border-color: $black;
    border-width: 2px;
    box-shadow: $shadow-md;

    @media (hover: hover) {
      &:hover {
        border-color: $black;
      }
    }

    .magazine-card__image {
      transform: scale(1.03);
    }
  }

  // ── Cover ──────────────────────────────────────────────────────────────────
  &__cover {
    position: relative;
    width: 100%;
    // 3:4 aspect ratio
    aspect-ratio: 3 / 4;
    overflow: hidden;
    background-color: $bg-tertiary;
    border-radius: $radius-md $radius-md 0 0;
  }

  &__image {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center top;
    background-repeat: no-repeat;
    transition: transform 400ms $ease-out-editorial;
  }

  @media (hover: hover) {
    &:hover .magazine-card__image {
      transform: scale(1.04);
    }
  }

  // ── Marketing badge (type) — top-left ──────────────────────────────────────
  &__type-badge {
    position: absolute;
    top: 12px;
    left: -2px; // slightly overhangs for a "tag" feel
    padding: 4px 10px 4px 12px;
    border-radius: 0 $radius-sm $radius-sm 0;
    font-family: $font-family-body;
    font-size: 11px;
    font-weight: $font-weight-bold;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    line-height: 1.3;
    color: #fff;
    box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.25);

    // Default fallback
    background: #1A1A1A;

    // ── Per-type solid colours ──────────────────────────────────────────────
    // TOP — rich black, gold accent shimmer
    &--top {
      background: #1A1A1A;
      box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.35);
    }

    // NEW — vivid emerald
    &--new {
      background: #00875A;
    }

    // SALE — bold crimson
    &--sale {
      background: #D32F2F;
    }

    // POPULAR — deep amber
    &--popular {
      background: #E65100;
    }

    // LIMITED — rich violet
    &--limited {
      background: #6A1B9A;
    }
  }

  // ── Selected checkmark badge — top-right ────────────────────────────────────
  &__sel-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: $black;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba($black, 0.3);
  }

  // ── Text ───────────────────────────────────────────────────────────────────
  &__body {
    padding: $spacing-4;
    display: flex;
    flex-direction: column;
    gap: $spacing-1;
    flex: 1;

    @include tablet-up {
      padding: $spacing-4 $spacing-4 $spacing-6;
    }
  }

  &__name {
    font-family: $font-family-display;
    font-size: $font-size-body;
    font-weight: $font-weight-medium;
    line-height: $line-height-subheading;
    letter-spacing: $letter-spacing-subheading;
    color: $text-primary;
    margin: 0;
  }

  &__description {
    font-family: $font-family-body;
    font-size: $font-size-caption;
    font-weight: $font-weight-regular;
    line-height: $line-height-body-sm;
    color: $text-muted;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  // ── Price block ─────────────────────────────────────────────────────────────
  &__price-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: $spacing-2;
    padding-top: $spacing-2;
    border-top: 1px solid $border-light;
  }

  &__price-row {
    display: flex;
    align-items: center;
    gap: $spacing-2;
  }

  &__old-price {
    font-family: $font-family-body;
    font-size: $font-size-caption;
    font-variant-numeric: tabular-nums;
    color: $text-muted;
    text-decoration: line-through;
  }

  &__discount {
    font-family: $font-family-body;
    font-size: 10px;
    font-weight: $font-weight-bold;
    letter-spacing: 0.04em;
    color: #fff;
    background: #D32F2F;
    border-radius: $radius-xs;
    padding: 2px 6px;
    white-space: nowrap;
  }

  &__price {
    font-family: $font-family-body;
    font-size: $font-size-body-sm;
    font-weight: $font-weight-semibold;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
    color: $text-primary;

    &--sale {
      font-size: $font-size-body;
    }
  }
}

// Selected-badge transition
.badge-enter-active {
  transition: opacity 200ms $ease-out-editorial, transform 200ms $ease-out-editorial;
}
.badge-leave-active {
  transition: opacity 150ms ease-in, transform 150ms ease-in;
}
.badge-enter-from,
.badge-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

// Marketing-badge transition
.type-badge-enter-active {
  transition: opacity 250ms $ease-out-editorial, transform 250ms $ease-out-editorial;
}
.type-badge-leave-active {
  transition: opacity 180ms ease-in;
}
.type-badge-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.type-badge-leave-to {
  opacity: 0;
}
</style>
