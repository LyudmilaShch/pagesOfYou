<template>
  <div class="constructor-price">
    <p v-if="quote" class="constructor-price__line">
      <span>Макет</span>
      <span :key="`layout-${layoutTick}`" class="constructor-price__amount" :class="{ 'is-ticking': layoutTick > 0 }">
        {{ formatRub(quote.layoutTotal) }}
      </span>
      <span class="constructor-price__slash" aria-hidden="true">/</span>
      <span>с печатью</span>
      <span :key="`print-${printTick}`" class="constructor-price__amount" :class="{ 'is-ticking': printTick > 0 }">
        {{ formatRub(quote.withPrintTotal) }}
      </span>
      <v-tooltip v-if="tip" location="bottom" content-class="constructor-price__tooltip">
        <template #activator="{ props: tipProps }">
          <button
            type="button"
            class="constructor-price__info"
            aria-label="Из чего складывается цена"
            v-bind="tipProps"
          >
            <v-icon size="16">mdi-information-outline</v-icon>
          </button>
        </template>
        <div class="constructor-price__tip">
          <p>Только макет — {{ tip.layout }}</p>
          <p>С печатью — {{ tip.together }}, из них печать {{ tip.print }}</p>
          <p class="constructor-price__tip-note">{{ tip.extraText }}</p>
          <p>На последнем шаге выберите: только макет или с печатью.</p>
          <p>Доставка считается отдельно.</p>
        </div>
      </v-tooltip>
    </p>

    <span class="constructor-price__rule" aria-hidden="true" />

    <router-link :to="{ name: 'account' }" class="constructor-price__account" aria-label="Личный кабинет">
      <v-icon size="26">mdi-account-circle</v-icon>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useOrderBuilderStore } from '../stores/order-builder.store'
import type { OrderDetail } from '../types/order.types'
import { countSpreadSlots } from '../utils/journal-structure.util'
import { formatRub, priceTooltip } from '../utils/price-copy.util'
import { quoteJournal, type JournalQuote, type JournalSpreadPricing } from '../utils/pricing.util'

const props = defineProps<{
  /** Checkout keeps its order outside the builder store. */
  order?: OrderDetail | null
}>()

const store = useOrderBuilderStore()
const route = useRoute()

const pricing = computed((): JournalSpreadPricing | null => {
  const order = props.order ?? store.order
  const selected = store.selectedMagazineType
  // Step 1 is the type picker: the header follows the card, even if a previous draft is still in memory.
  if (route.name === 'create-order' && selected) {
    return selected
  }
  if (selected && order && selected.id === order.magazineTypeId) {
    return selected
  }
  if (order) {
    return order.magazineType
  }
  return selected ?? store.magazineTypes[0] ?? null
})

const spreadCount = computed(() => {
  const order = props.order ?? store.order
  const selected = store.selectedMagazineType
  if (route.name === 'create-order' && (!order || (selected && selected.id !== order.magazineTypeId))) {
    return 0
  }
  return order ? countSpreadSlots(order.journalPages) : 0
})

const quote = computed((): JournalQuote | null => {
  if (!pricing.value) {
    return null
  }
  return quoteJournal(pricing.value, spreadCount.value)
})

const tip = computed(() => (quote.value ? priceTooltip(quote.value) : null))

const layoutTick = ref(0)
const printTick = ref(0)
watch(
  () => quote.value?.layoutTotal,
  (next, prev) => {
    if (prev != null && next != null && next !== prev) {
      layoutTick.value += 1
    }
  },
)
watch(
  () => quote.value?.withPrintTotal,
  (next, prev) => {
    if (prev != null && next != null && next !== prev) {
      printTick.value += 1
    }
  },
)
</script>

<style scoped lang="scss">
.constructor-price {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: $text-primary;
}

.constructor-price__line {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 13px;
  font-weight: $font-weight-medium;
  letter-spacing: 0.01em;
  white-space: nowrap;

  @include mobile-only {
    gap: 3px;
    font-size: 11px;
  }
}

.constructor-price__slash {
  color: $text-muted;
}

.constructor-price__amount {
  display: inline-block;

  &.is-ticking {
    animation: constructor-price-tick 420ms ease;
  }
}

.constructor-price__info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 2px;
  padding: 0;
  border: 1px solid $border-default;
  border-radius: 50%;
  background: transparent;
  color: $text-muted;
  cursor: pointer;

  &:hover {
    color: $text-primary;
    border-color: $text-muted;
  }
}

.constructor-price__rule {
  width: 1px;
  height: 18px;
  flex-shrink: 0;
  background: $border-default;
}

.constructor-price__account {
  display: inline-flex;
  align-items: center;
  color: $text-primary;
  text-decoration: none;

  &:hover {
    color: $accent;
  }
}

@keyframes constructor-price-tick {
  0% {
    opacity: 0.35;
    transform: translateY(4px);
  }
  60% {
    opacity: 1;
    transform: translateY(-1px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

<style lang="scss">
.constructor-price__tooltip {
  padding: 10px 12px !important;
}

.constructor-price__tip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 280px;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.45;
  text-align: left;
  white-space: normal;
}

.constructor-price__tip-note {
  margin-top: 6px;
}

.constructor-price__tip p {
  margin: 0;
}
</style>
