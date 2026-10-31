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

          <v-divider />

          <h2 class="settings-page__section-title">ИИ-тексты журнала</h2>
          <p class="settings-page__hint">
            Первый текст каждого блока журнала создаётся всегда — настройки ниже не мешают
            заполнить журнал до конца. «Текст» — один текстовый блок или набор связанных частей
            целиком. Все суточные лимиты общие для всех журналов человека, новые сутки начинаются
            в 03:00 по Москве.
          </p>

          <h3 class="settings-page__subsection-title">Новые варианты текста</h3>
          <v-text-field
            v-model.number="form.aiDailyLimitUser"
            label="Пользователь: новых вариантов в сутки"
            suffix="в сутки"
            hint="Сколько раз вошедший пользователь может получить другой вариант уже написанного текста — кнопкой 🔄 или изменив ответ в анкете. Рядом с кнопкой показывается «осталось N». 0 — только ручная правка."
            persistent-hint
            type="number"
            min="0"
            variant="outlined"
          />
          <v-text-field
            v-model.number="form.aiGuestAutoUpdatesPerText"
            label="Гость: обновлений текста при изменении ответа"
            suffix="на блок"
            hint="Гость без входа не может нажимать 🔄. Но если он меняет ответ в анкете, текст блока перепишется сам — столько раз. Дальше текст останется прежним, а гостю предложат войти."
            persistent-hint
            type="number"
            min="0"
            variant="outlined"
          />

          <h3 class="settings-page__subsection-title">Защита от злоупотреблений</h3>
          <p class="settings-page__hint">
            Сколько всего текстов человек может получить за сутки — на случай, если кто-то создаёт
            журналы пачками ради генерации. Один журнал — обычно 10–30 текстов, так что обычные
            покупатели до этих чисел не доходят. Когда предел достигнут, новые тексты появятся
            на следующий день.
          </p>
          <v-text-field
            v-model.number="form.aiDailyFillCapUser"
            label="Пользователь: всего текстов"
            suffix="в сутки"
            type="number"
            min="0"
            variant="outlined"
          />
          <v-text-field
            v-model.number="form.aiDailyFillCapGuest"
            label="Гость: всего текстов"
            suffix="в сутки"
            hint="Считается вместе с автообновлениями гостя. Для всех гостей с одного IP-адреса — в 3 раза больше."
            persistent-hint
            type="number"
            min="0"
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
  aiDailyLimitUser: 30,
  aiDailyFillCapUser: 300,
  aiDailyFillCapGuest: 150,
  aiGuestAutoUpdatesPerText: 2,
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
  form.aiDailyLimitUser = item.aiDailyLimitUser
  form.aiDailyFillCapUser = item.aiDailyFillCapUser
  form.aiDailyFillCapGuest = item.aiDailyFillCapGuest
  form.aiGuestAutoUpdatesPerText = item.aiGuestAutoUpdatesPerText
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
      aiDailyLimitUser: form.aiDailyLimitUser,
      aiDailyFillCapUser: form.aiDailyFillCapUser,
      aiDailyFillCapGuest: form.aiDailyFillCapGuest,
      aiGuestAutoUpdatesPerText: form.aiGuestAutoUpdatesPerText,
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

.settings-page__section-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.settings-page__subsection-title {
  margin: $spacing-2 0 0;
  font-size: $font-size-body;
  font-weight: 600;
}

.settings-page__hint {
  margin: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
}
</style>
