<template>
  <div class="settings-page">
    <div class="settings-page__inner">
      <header class="settings-page__header">
        <h1 class="settings-page__title">Настройки платформы</h1>
      </header>

      <v-card variant="outlined" class="settings-page__card">
        <v-card-text class="settings-page__form">
          <p class="settings-page__hint">
            Диапазон показывается пользователю на странице оформления заказа: «Изготовление
            журнала занимает N–M рабочих дней после подтверждения заказа».
          </p>
          <v-text-field
            v-model.number="form.productionDaysMin"
            label="Срок изготовления, мин. дней"
            type="number"
            min="1"
            variant="outlined"
          />
          <v-text-field
            v-model.number="form.productionDaysMax"
            label="Срок изготовления, макс. дней"
            type="number"
            min="1"
            :rules="[maxNotLessThanMin]"
            variant="outlined"
          />
          <v-btn color="primary" :loading="saving" @click="save">Сохранить</v-btn>
        </v-card-text>
      </v-card>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { adminSettingsApi } from '@/shared/api/admin/settings.api'

const saving = ref(false)

const form = reactive({
  productionDaysMin: 5,
  productionDaysMax: 7,
})

const snackbar = reactive({
  show: false,
  text: '',
  color: 'success' as 'success' | 'error',
})

const maxNotLessThanMin = (v: number) =>
  v >= form.productionDaysMin || 'Не может быть меньше минимального срока'

function notify(text: string, color: 'success' | 'error'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

async function load(): Promise<void> {
  const item = await adminSettingsApi.get()
  form.productionDaysMin = item.productionDaysMin
  form.productionDaysMax = item.productionDaysMax
}

async function save(): Promise<void> {
  if (form.productionDaysMax < form.productionDaysMin) {
    notify('Максимальный срок не может быть меньше минимального', 'error')
    return
  }

  saving.value = true
  try {
    await adminSettingsApi.update({
      productionDaysMin: form.productionDaysMin,
      productionDaysMax: form.productionDaysMax,
    })
    notify('Сохранено', 'success')
  } catch {
    notify('Ошибка сохранения', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped lang="scss">
.settings-page__inner {
  @include page-container;
  padding-top: $spacing-8;
  padding-bottom: $spacing-12;
}

.settings-page__header {
  margin-bottom: $spacing-6;
}

.settings-page__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-h3;
}

.settings-page__card {
  padding: $spacing-2;
}

.settings-page__form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  max-width: 560px;
}

.settings-page__hint {
  margin: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
}
</style>
