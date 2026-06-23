<template>
  <div class="dashboard">
    <div class="dashboard__inner">

      <!-- Page heading -->
      <header class="dashboard__header">
        <div>
          <p class="dashboard__eyebrow text-caption text-secondary">Добро пожаловать,</p>
          <h1 class="dashboard__title">{{ store.admin?.name ?? store.adminEmail }}</h1>
        </div>
        <span class="dashboard__date">{{ formattedDate }}</span>
      </header>

      <v-divider class="dashboard__divider" />

      <!-- Stats grid -->
      <section aria-label="Сводка показателей">
        <h2 class="dashboard__section-title">Обзор каталога</h2>
        <div class="dashboard__stats">
          <article
            v-for="stat in catalogStats"
            :key="stat.label"
            class="stat-card"
            :class="`stat-card--${stat.color}`"
          >
            <div class="stat-card__icon">
              <v-icon size="22">{{ stat.icon }}</v-icon>
            </div>
            <div class="stat-card__body">
              <span v-if="stat.value === '…'" class="stat-card__value">
                <v-skeleton-loader type="text" width="32" height="24" style="display:inline-block" />
              </span>
              <span v-else class="stat-card__value">{{ stat.value }}</span>
              <span class="stat-card__label">{{ stat.label }}</span>
            </div>
            <router-link :to="stat.to" class="stat-card__link" :aria-label="stat.label">
              <v-icon size="16">mdi-arrow-right</v-icon>
            </router-link>
          </article>
        </div>
      </section>

      <!-- Orders section -->
      <section class="dashboard__orders" aria-label="Заказы">
        <div class="dashboard__orders-header">
          <h2 class="dashboard__section-title">Заказы</h2>
          <div class="dashboard__orders-stats">
            <div
              v-for="s in orderStats"
              :key="s.label"
              class="order-badge"
              :class="`order-badge--${s.color}`"
            >
              <span class="order-badge__value">{{ s.value }}</span>
              <span class="order-badge__label">{{ s.label }}</span>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div class="dashboard__empty">
          <v-icon size="40" color="textDisabled">mdi-package-variant-closed</v-icon>
          <p>Заказов пока нет</p>
          <span>Здесь будут отображаться все заказы покупателей</span>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAdminAuthStore } from '../stores/admin-auth.store'
import { adminMagazineTypesApi } from '@/shared/api/admin/magazine-types.api'

const store = useAdminAuthStore()

const formattedDate = computed(() =>
  new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
)

// ── Real counts ───────────────────────────────────────────────────────────────

const magazineTypesCount = ref<number | null>(null)

onMounted(async () => {
  try {
    const { total } = await adminMagazineTypesApi.list({ limit: 1, page: 1 })
    magazineTypesCount.value = total
  } catch {
    magazineTypesCount.value = null
  }
})

// ── Stat cards ────────────────────────────────────────────────────────────────

const catalogStats = computed(() => [
  {
    label: 'Типы журналов',
    value: magazineTypesCount.value ?? '…',
    icon: 'mdi-book-open-outline',
    to: '/admin/magazine-types',
    color: 'neutral',
  },
  {
    label: 'Стили журналов',
    value: '—',
    icon: 'mdi-palette-outline',
    to: '/admin/magazine-styles',
    color: 'neutral',
  },
  {
    label: 'Развороты',
    value: '—',
    icon: 'mdi-table-large',
    to: '/admin/spreads',
    color: 'neutral',
  },
  {
    label: 'Всего заказов',
    value: 0,
    icon: 'mdi-package-variant-closed',
    to: '/admin/orders',
    color: 'neutral',
  },
])

const orderStats = [
  { label: 'Новые', value: 0, color: 'info' },
  { label: 'В работе', value: 0, color: 'warning' },
  { label: 'Доставлены', value: 0, color: 'success' },
]
</script>

<style scoped lang="scss">
.dashboard {
  min-height: calc(100vh - 56px);

  @include desktop-up {
    min-height: 100vh;
  }
}

.dashboard__inner {
  @include page-container;
  max-width: 1100px;
  margin-inline: auto;
  padding-block: $spacing-8 $spacing-16;
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
}

// ── Header ────────────────────────────────────────────────────────────────────
.dashboard__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $spacing-3;
}

.dashboard__eyebrow {
  margin-bottom: $spacing-1;
}

.dashboard__title {
  font-family: $font-family-display;
  font-size: $font-size-h3;
  font-weight: $font-weight-regular;
  letter-spacing: $letter-spacing-heading;
  color: $text-primary;
  margin: 0;
}

.dashboard__date {
  font-size: $font-size-body-sm;
  color: $text-muted;
  align-self: flex-end;
  padding-bottom: 4px;
  text-transform: capitalize;
}

.dashboard__divider {
  border-color: $border-light;
}

// ── Section title ─────────────────────────────────────────────────────────────
.dashboard__section-title {
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  font-weight: $font-weight-semibold;
  letter-spacing: $letter-spacing-caption;
  text-transform: uppercase;
  color: $text-muted;
  margin-bottom: $spacing-4;
}

// ── Stats grid ────────────────────────────────────────────────────────────────
.dashboard__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-3;

  @include tablet-up {
    grid-template-columns: repeat(4, 1fr);
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: $spacing-3;
  background: $bg-elevated;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  padding: $spacing-4;
  position: relative;
  transition:
    box-shadow 200ms $ease-out-editorial,
    border-color 200ms;

  &:hover {
    box-shadow: $shadow-sm;
    border-color: $border-strong;
  }

  &__icon {
    width: 40px;
    height: 40px;
    border-radius: $radius-sm;
    background: $bg-tertiary;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: $text-secondary;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  &__value {
    font-family: $font-family-display;
    font-size: $font-size-h4;
    font-weight: $font-weight-medium;
    color: $text-primary;
    line-height: 1.2;
  }

  &__label {
    font-size: $font-size-caption;
    color: $text-muted;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__link {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: $spacing-3;
    color: $text-disabled;
    opacity: 0;
    transition: opacity 200ms;
    text-decoration: none;
  }

  &:hover &__link {
    opacity: 1;
  }
}

// ── Orders section ────────────────────────────────────────────────────────────
.dashboard__orders-header {
  display: flex;
  align-items: center;
  gap: $spacing-6;
  flex-wrap: wrap;
  margin-bottom: $spacing-4;
}

.dashboard__orders-stats {
  display: flex;
  gap: $spacing-4;
}

.order-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  &__value {
    font-size: $font-size-body;
    font-weight: $font-weight-semibold;
    color: $text-primary;
  }

  &__label {
    font-size: $font-size-caption;
    color: $text-muted;
  }
}

.dashboard__empty {
  background: $bg-elevated;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  padding: $spacing-12 $spacing-8;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-2;
  text-align: center;

  p {
    font-family: $font-family-body;
    font-size: $font-size-body;
    font-weight: $font-weight-medium;
    color: $text-primary;
    margin: 0;
  }

  span {
    font-size: $font-size-body-sm;
    color: $text-muted;
  }
}
</style>
